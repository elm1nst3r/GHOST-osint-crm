// File: backend/utils/transactionHelpers.js
// Shared helpers for the transaction-tracking feature (issue #43):
// resolved party/subject/location decoration, geocoding, and a custody resolver.

// SELECT fragment for transactions with all label/coordinate joins.
// Append a WHERE / ORDER BY clause when using it.
const TX_SELECT = `
  SELECT t.*,
    fp.first_name AS from_person_first, fp.last_name AS from_person_last,
    fb.name AS from_business_name,
    fw.label AS from_wallet_label, fw.address AS from_wallet_address,
    tp.first_name AS to_person_first, tp.last_name AS to_person_last,
    tb.name AS to_business_name,
    tw.label AS to_wallet_label, tw.address AS to_wallet_address,
    sa.name AS subject_asset_name,
    sb.name AS subject_business_name,
    sp.name AS subject_property_name,
    lb.name AS location_business_name, lb.latitude AS location_business_lat, lb.longitude AS location_business_lng,
    lp.name AS location_property_name, lp.latitude AS location_property_lat, lp.longitude AS location_property_lng
  FROM transactions t
  LEFT JOIN people     fp ON t.from_person_id     = fp.id
  LEFT JOIN businesses fb ON t.from_business_id   = fb.id
  LEFT JOIN crypto_wallets fw ON t.from_wallet_id = fw.id
  LEFT JOIN people     tp ON t.to_person_id       = tp.id
  LEFT JOIN businesses tb ON t.to_business_id     = tb.id
  LEFT JOIN crypto_wallets tw ON t.to_wallet_id   = tw.id
  LEFT JOIN assets     sa ON t.subject_asset_id   = sa.id
  LEFT JOIN businesses sb ON t.subject_business_id= sb.id
  LEFT JOIN properties sp ON t.subject_property_id= sp.id
  LEFT JOIN businesses lb ON t.location_business_id  = lb.id
  LEFT JOIN properties lp ON t.location_property_id  = lp.id
`;

function fullName(first, last) {
  return [first, last].filter(Boolean).join(' ').trim();
}

function resolveParty(row, dir) {
  // dir is 'from' or 'to'
  const personId = row[`${dir}_person_id`];
  const businessId = row[`${dir}_business_id`];
  const walletId = row[`${dir}_wallet_id`];
  const external = row[`${dir}_external`];
  if (personId) {
    return { type: 'person', id: personId, label: fullName(row[`${dir}_person_first`], row[`${dir}_person_last`]) || `Person #${personId}` };
  }
  if (businessId) {
    return { type: 'business', id: businessId, label: row[`${dir}_business_name`] || `Business #${businessId}` };
  }
  if (walletId) {
    const label = row[`${dir}_wallet_label`] || row[`${dir}_wallet_address`] || `Wallet #${walletId}`;
    return { type: 'crypto_wallet', id: walletId, label };
  }
  if (external) {
    return { type: 'external', id: null, label: external };
  }
  return null;
}

function resolveSubject(row) {
  if (row.subject_asset_id) {
    return { type: 'asset', id: row.subject_asset_id, label: row.subject_asset_name || `Asset #${row.subject_asset_id}` };
  }
  if (row.subject_business_id) {
    return { type: 'business', id: row.subject_business_id, label: row.subject_business_name || `Business #${row.subject_business_id}` };
  }
  if (row.subject_property_id) {
    return { type: 'property', id: row.subject_property_id, label: row.subject_property_name || `Property #${row.subject_property_id}` };
  }
  if (row.item_label) {
    return { type: 'item', id: null, label: row.item_label, category: row.item_category || null };
  }
  return { type: 'item', id: null, label: null, category: row.item_category || null };
}

function resolveLocation(row) {
  if (row.location_business_id) {
    return {
      type: 'business', id: row.location_business_id, label: row.location_business_name || `Business #${row.location_business_id}`,
      latitude: row.location_business_lat != null ? parseFloat(row.location_business_lat) : null,
      longitude: row.location_business_lng != null ? parseFloat(row.location_business_lng) : null,
    };
  }
  if (row.location_property_id) {
    return {
      type: 'property', id: row.location_property_id, label: row.location_property_name || `Property #${row.location_property_id}`,
      latitude: row.location_property_lat != null ? parseFloat(row.location_property_lat) : null,
      longitude: row.location_property_lng != null ? parseFloat(row.location_property_lng) : null,
    };
  }
  if (row.location_name || row.latitude || row.address || row.city) {
    return {
      type: 'place', id: null, label: row.location_name || [row.city, row.country].filter(Boolean).join(', ') || null,
      latitude: row.latitude != null ? parseFloat(row.latitude) : null,
      longitude: row.longitude != null ? parseFloat(row.longitude) : null,
    };
  }
  return { type: 'none', id: null, label: null, latitude: null, longitude: null };
}

// Strip the joined helper columns and attach resolved objects.
function decorateTransaction(row) {
  const resolved_from = resolveParty(row, 'from');
  const resolved_to = resolveParty(row, 'to');
  const resolved_subject = resolveSubject(row);
  const resolved_location = resolveLocation(row);

  const clean = { ...row };
  // remove join-only helper columns
  [
    'from_person_first', 'from_person_last', 'from_business_name',
    'from_wallet_label', 'from_wallet_address',
    'to_person_first', 'to_person_last', 'to_business_name',
    'to_wallet_label', 'to_wallet_address',
    'subject_asset_name', 'subject_business_name', 'subject_property_name',
    'location_business_name', 'location_business_lat', 'location_business_lng',
    'location_property_name', 'location_property_lat', 'location_property_lng',
  ].forEach(k => delete clean[k]);

  return { ...clean, resolved_from, resolved_to, resolved_subject, resolved_location };
}

// Geocode free-text address fields. Non-fatal: returns coords or a failure reason.
// projectId scopes the geocoding cache so a hit from one investigation can't
// surface in an unrelated one (issue #83 follow-up).
async function geocodeFields(service, fields, projectId = null) {
  const parts = [fields.address, fields.city, fields.state, fields.country].filter(Boolean);
  if (!service || parts.length === 0) {
    return { latitude: null, longitude: null, geocode_confidence: null, geocode_provider: null, geocoded_at: null, geocode_failure: parts.length === 0 ? 'empty' : 'service_error' };
  }
  try {
    const result = await service.geocodeAddress(parts.join(', '), { minConfidence: 30, projectId });
    if (result && !result.failure) {
      return {
        latitude: result.lat,
        longitude: result.lng,
        geocode_confidence: result.confidence != null ? Math.round(result.confidence) : null,
        geocode_provider: result.provider || null,
        geocoded_at: new Date(),
        geocode_failure: null,
      };
    }
    return { latitude: null, longitude: null, geocode_confidence: null, geocode_provider: null, geocoded_at: null, geocode_failure: (result && result.failure) || 'not_found' };
  } catch (err) {
    console.error('geocodeFields error:', err.message);
    return { latitude: null, longitude: null, geocode_confidence: null, geocode_provider: null, geocoded_at: null, geocode_failure: 'service_error' };
  }
}

// Given an ordered (occurred_on ASC, id ASC) list of decorated transactions for a
// single subject, return { currentHolder, chain }. ownershipTypes optionally limits
// which transaction types count as a change of ownership (for businesses/properties).
function deriveCustody(orderedTxns, ownershipTypes) {
  const chain = orderedTxns.map(t => ({
    transaction_id: t.id,
    occurred_on: t.occurred_on,
    transaction_type: t.transaction_type,
    from: t.resolved_from,
    to: t.resolved_to,
    value: t.value,
    currency: t.currency,
  }));
  let currentHolder = null;
  let since = null;
  for (const t of orderedTxns) {
    if (ownershipTypes && !ownershipTypes.includes(t.transaction_type)) continue;
    if (t.resolved_to) {
      currentHolder = t.resolved_to;
      since = t.occurred_on;
    }
  }
  return { currentHolder, since, chain };
}

// Pure venue-stats aggregation from raw joined transaction rows (location_business_id = id).
function aggregateVenueStats(rawRows) {
  const peopleMap = new Map();
  const byType = {};
  let firstEvent = null, lastEvent = null;
  const decorated = rawRows.map(decorateTransaction);
  decorated.forEach(t => {
    byType[t.transaction_type] = (byType[t.transaction_type] || 0) + 1;
    if (t.occurred_on) {
      const d = t.occurred_on instanceof Date ? t.occurred_on.toISOString().slice(0, 10) : String(t.occurred_on);
      if (!firstEvent || d < firstEvent) firstEvent = d;
      if (!lastEvent || d > lastEvent) lastEvent = d;
    }
    [t.resolved_from, t.resolved_to].forEach(party => {
      if (party && party.type === 'person' && party.id) {
        const cur = peopleMap.get(party.id) || { id: party.id, label: party.label, event_count: 0 };
        cur.event_count += 1;
        peopleMap.set(party.id, cur);
      }
    });
  });
  const people = Array.from(peopleMap.values()).sort((a, b) => b.event_count - a.event_count);
  return { event_count: decorated.length, distinct_people: people.length, people, first_event: firstEvent, last_event: lastEvent, by_type: byType };
}

// Pure ledger derivation (entries + summary) for an entity from raw joined rows.
// kind ∈ 'person'|'business'|'property'. assets_currently_held is added by the caller.
function deriveLedger(kind, id, rawRows) {
  const entries = [];
  const seen = new Set();
  const counterpartyKeys = new Set();
  const countByType = {};
  const byCurrencyMap = new Map();
  const ensureCurrency = (cur) => {
    const c = cur || 'UNSPEC';
    if (!byCurrencyMap.has(c)) byCurrencyMap.set(c, { currency: cur || null, value_in: 0, value_out: 0, net: 0 });
    return byCurrencyMap.get(c);
  };

  rawRows.forEach(raw => {
    const t = decorateTransaction(raw);
    countByType[t.transaction_type] = (countByType[t.transaction_type] || 0) + 1;
    const isTo = kind === 'person' ? raw.to_person_id === id : kind === 'business' ? raw.to_business_id === id : false;
    const isFrom = kind === 'person' ? raw.from_person_id === id : kind === 'business' ? raw.from_business_id === id : false;
    const isSubject = kind === 'business' ? raw.subject_business_id === id : kind === 'property' ? raw.subject_property_id === id : false;
    const isVenue = kind === 'business' ? raw.location_business_id === id : kind === 'property' ? raw.location_property_id === id : false;
    const value = t.value != null ? parseFloat(t.value) : null;

    const pushEntry = (role, value_direction, counterparty, entryValue) => {
      const key = `${t.id}:${role}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (counterparty && counterparty.label) counterpartyKeys.add(`${counterparty.type}:${counterparty.id}:${counterparty.label}`);
      entries.push({
        transaction_id: t.id, occurred_on: t.occurred_on, transaction_type: t.transaction_type,
        role, counterparty: counterparty || null, subject: t.resolved_subject, location: t.resolved_location,
        value: entryValue, currency: t.currency, value_direction, notes: t.notes,
      });
    };

    if (isTo) {
      pushEntry('received', 'in', t.resolved_from, value);
      if (value != null) ensureCurrency(t.currency).value_in += value;
      if (raw.subject_asset_id) pushEntry('acquired_custody', 'in', t.resolved_from, null);
    }
    if (isFrom) {
      pushEntry('gave', 'out', t.resolved_to, value);
      if (value != null) ensureCurrency(t.currency).value_out += value;
      if (raw.subject_asset_id) pushEntry('released_custody', 'out', t.resolved_to, null);
    }
    if (isSubject) pushEntry('subject', 'neutral', t.resolved_from || t.resolved_to, value);
    if (isVenue) pushEntry('venue', 'neutral', t.resolved_from || t.resolved_to, value);
  });

  entries.sort((a, b) => {
    const da = a.occurred_on || ''; const db = b.occurred_on || '';
    if (da === db) return a.transaction_id - b.transaction_id;
    return da < db ? -1 : 1;
  });

  const byCurrency = Array.from(byCurrencyMap.values()).map(c => ({ ...c, net: c.value_in - c.value_out }));
  const totalIn = byCurrency.reduce((s, c) => s + c.value_in, 0);
  const totalOut = byCurrency.reduce((s, c) => s + c.value_out, 0);
  const singleCurrency = byCurrency.length <= 1;

  return {
    entries,
    summary: {
      value_in: singleCurrency ? totalIn : null,
      value_out: singleCurrency ? totalOut : null,
      net: singleCurrency ? totalIn - totalOut : null,
      by_currency: byCurrency,
      count_by_type: countByType,
      distinct_counterparties: counterpartyKeys.size,
    },
  };
}

// Pure validation of transaction body shape (§5 rules 2-5). The transaction_type
// required + active-option check stays in the route (needs DB). Returns error string or null.
const FROM_REFS = ['from_person_id', 'from_business_id', 'from_wallet_id', 'from_external'];
const TO_REFS = ['to_person_id', 'to_business_id', 'to_wallet_id', 'to_external'];
const SUBJECT_REFS = ['subject_asset_id', 'subject_business_id', 'subject_property_id'];
const LOCATION_REFS = ['location_business_id', 'location_property_id'];

function countSet(body, keys) {
  return keys.filter(k => body[k] !== undefined && body[k] !== null && body[k] !== '').length;
}
// Error message for mutually exclusive reference groups that names the
// conflicting fields and their values, so an API caller can see exactly
// which one to drop without another round trip (issue #43 feedback).
function exclusivityError(body, keys, groupLabel) {
  const set = keys.filter(k => body[k] !== undefined && body[k] !== null && body[k] !== '');
  const listed = set.map(k => `${k} (${JSON.stringify(body[k])})`).join(' and ');
  return `${listed} are both set; include at most one of ${keys.join(', ')} as the ${groupLabel}`;
}
function isPositiveIntOrNull(v) {
  if (v === undefined || v === null || v === '') return true;
  const n = Number(v);
  return Number.isInteger(n) && n > 0;
}

function validateTransactionShape(body) {
  if (countSet(body, FROM_REFS) === 0 && countSet(body, TO_REFS) === 0) {
    return 'At least one party (from_* or to_*) is required';
  }
  if (countSet(body, FROM_REFS) > 1) return exclusivityError(body, FROM_REFS, 'giver');
  if (countSet(body, TO_REFS) > 1) return exclusivityError(body, TO_REFS, 'receiver');
  if (countSet(body, SUBJECT_REFS) > 1) return exclusivityError(body, SUBJECT_REFS, 'referenced subject');
  if (countSet(body, LOCATION_REFS) > 1) return exclusivityError(body, LOCATION_REFS, 'event location reference');
  for (const k of [...FROM_REFS.slice(0, 3), ...TO_REFS.slice(0, 3), ...SUBJECT_REFS, ...LOCATION_REFS, 'case_id']) {
    if (!isPositiveIntOrNull(body[k])) return `${k} must be a positive integer`;
  }
  if (body.value != null && body.value !== '' && (isNaN(Number(body.value)) || Number(body.value) < 0)) {
    return 'value must be a non-negative number';
  }
  if (body.occurred_on) {
    const d = new Date(body.occurred_on);
    if (isNaN(d.getTime())) return 'occurred_on is not a valid date';
  }
  return null;
}

module.exports = {
  TX_SELECT,
  FROM_REFS,
  TO_REFS,
  SUBJECT_REFS,
  LOCATION_REFS,
  countSet,
  isPositiveIntOrNull,
  validateTransactionShape,
  fullName,
  resolveParty,
  resolveSubject,
  resolveLocation,
  decorateTransaction,
  geocodeFields,
  deriveCustody,
  aggregateVenueStats,
  deriveLedger,
};
