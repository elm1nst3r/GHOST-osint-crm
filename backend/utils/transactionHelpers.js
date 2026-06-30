// File: backend/utils/transactionHelpers.js
// Shared helpers for the transaction-tracking feature (issue #43):
// resolved party/subject/location decoration, geocoding, and a custody resolver.

// SELECT fragment for transactions with all label/coordinate joins.
// Append a WHERE / ORDER BY clause when using it.
const TX_SELECT = `
  SELECT t.*,
    fp.first_name AS from_person_first, fp.last_name AS from_person_last,
    fb.name AS from_business_name,
    tp.first_name AS to_person_first, tp.last_name AS to_person_last,
    tb.name AS to_business_name,
    sa.name AS subject_asset_name,
    sb.name AS subject_business_name,
    sp.name AS subject_property_name,
    lb.name AS location_business_name, lb.latitude AS location_business_lat, lb.longitude AS location_business_lng,
    lp.name AS location_property_name, lp.latitude AS location_property_lat, lp.longitude AS location_property_lng
  FROM transactions t
  LEFT JOIN people     fp ON t.from_person_id     = fp.id
  LEFT JOIN businesses fb ON t.from_business_id   = fb.id
  LEFT JOIN people     tp ON t.to_person_id       = tp.id
  LEFT JOIN businesses tb ON t.to_business_id     = tb.id
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
  const external = row[`${dir}_external`];
  if (personId) {
    return { type: 'person', id: personId, label: fullName(row[`${dir}_person_first`], row[`${dir}_person_last`]) || `Person #${personId}` };
  }
  if (businessId) {
    return { type: 'business', id: businessId, label: row[`${dir}_business_name`] || `Business #${businessId}` };
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
    'to_person_first', 'to_person_last', 'to_business_name',
    'subject_asset_name', 'subject_business_name', 'subject_property_name',
    'location_business_name', 'location_business_lat', 'location_business_lng',
    'location_property_name', 'location_property_lat', 'location_property_lng',
  ].forEach(k => delete clean[k]);

  return { ...clean, resolved_from, resolved_to, resolved_subject, resolved_location };
}

// Geocode free-text address fields. Non-fatal: returns coords or a failure reason.
async function geocodeFields(service, fields) {
  const parts = [fields.address, fields.city, fields.state, fields.country].filter(Boolean);
  if (!service || parts.length === 0) {
    return { latitude: null, longitude: null, geocode_confidence: null, geocode_provider: null, geocoded_at: null, geocode_failure: parts.length === 0 ? 'empty' : 'service_error' };
  }
  try {
    const result = await service.geocodeAddress(parts.join(', '), { minConfidence: 30 });
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

module.exports = {
  TX_SELECT,
  fullName,
  resolveParty,
  resolveSubject,
  resolveLocation,
  decorateTransaction,
  geocodeFields,
  deriveCustody,
};
