const {
  resolveParty,
  resolveSubject,
  resolveLocation,
  decorateTransaction,
  geocodeFields,
  deriveCustody,
  aggregateVenueStats,
  deriveLedger,
  validateTransactionShape,
} = require('./transactionHelpers');

// ── validateTransactionShape (§5 rules) ─────────────────────────────────────

describe('validateTransactionShape', () => {
  test('accepts a minimal valid transaction', () => {
    expect(validateTransactionShape({ to_person_id: 1 })).toBeNull();
  });
  test('rejects no party', () => {
    expect(validateTransactionShape({})).toMatch(/at least one party/i);
  });
  test('rejects two givers, naming the conflicting fields', () => {
    const err = validateTransactionShape({ from_person_id: 1, from_business_id: 2 });
    expect(err).toMatch(/from_person_id \(1\) and from_business_id \(2\) are both set/);
    expect(err).toMatch(/at most one of from_person_id, from_business_id, from_external/);
  });
  test('rejects two subject references, naming the conflicting fields', () => {
    const err = validateTransactionShape({ to_person_id: 1, subject_asset_id: 1, subject_business_id: 2 });
    expect(err).toMatch(/subject_asset_id \(1\) and subject_business_id \(2\) are both set/);
  });
  test('rejects two location references, naming the conflicting fields', () => {
    const err = validateTransactionShape({ to_person_id: 1, location_business_id: 1, location_property_id: 2 });
    expect(err).toMatch(/location_business_id \(1\) and location_property_id \(2\) are both set/);
  });
  test('rejects negative value', () => {
    expect(validateTransactionShape({ to_person_id: 1, value: -5 })).toMatch(/non-negative/i);
  });
  test('rejects invalid date', () => {
    expect(validateTransactionShape({ to_person_id: 1, occurred_on: 'not-a-date' })).toMatch(/valid date/i);
  });
  test('rejects non-positive FK id', () => {
    expect(validateTransactionShape({ to_person_id: -3 })).toMatch(/positive integer/i);
  });
});

// ── resolveParty ────────────────────────────────────────────────────────────

describe('resolveParty', () => {
  test('resolves a person party', () => {
    const row = { from_person_id: 7, from_person_first: 'Jane', from_person_last: 'Roe' };
    expect(resolveParty(row, 'from')).toEqual({ type: 'person', id: 7, label: 'Jane Roe' });
  });
  test('resolves a business party', () => {
    const row = { to_business_id: 5, to_business_name: 'Bistro X' };
    expect(resolveParty(row, 'to')).toEqual({ type: 'business', id: 5, label: 'Bistro X' });
  });
  test('resolves an external party', () => {
    expect(resolveParty({ from_external: 'Acme Corp' }, 'from')).toEqual({ type: 'external', id: null, label: 'Acme Corp' });
  });
  test('returns null when no party set', () => {
    expect(resolveParty({}, 'from')).toBeNull();
  });
});

// ── resolveSubject ──────────────────────────────────────────────────────────

describe('resolveSubject', () => {
  test('asset subject wins over item label', () => {
    const s = resolveSubject({ subject_asset_id: 3, subject_asset_name: 'Rolex', item_label: 'ignore' });
    expect(s).toEqual({ type: 'asset', id: 3, label: 'Rolex' });
  });
  test('free-text item subject', () => {
    const s = resolveSubject({ item_label: 'Dinner', item_category: 'hospitality' });
    expect(s).toEqual({ type: 'item', id: null, label: 'Dinner', category: 'hospitality' });
  });
});

// ── resolveLocation ─────────────────────────────────────────────────────────

describe('resolveLocation', () => {
  test('business venue location', () => {
    const l = resolveLocation({ location_business_id: 5, location_business_name: 'Bistro X', location_business_lat: '1.5', location_business_lng: '2.5' });
    expect(l).toEqual({ type: 'business', id: 5, label: 'Bistro X', latitude: 1.5, longitude: 2.5 });
  });
  test('free-text place location', () => {
    const l = resolveLocation({ location_name: 'Park', latitude: '10', longitude: '20' });
    expect(l.type).toBe('place');
    expect(l.latitude).toBe(10);
  });
  test('none when no location', () => {
    expect(resolveLocation({}).type).toBe('none');
  });
});

// ── decorateTransaction ─────────────────────────────────────────────────────

describe('decorateTransaction', () => {
  test('attaches resolved fields and strips join columns', () => {
    const row = {
      id: 1, transaction_type: 'gift',
      from_person_id: 7, from_person_first: 'Jane', from_person_last: 'Roe',
      to_business_id: 5, to_business_name: 'Bistro X',
      item_label: 'Tickets',
    };
    const d = decorateTransaction(row);
    expect(d.resolved_from.label).toBe('Jane Roe');
    expect(d.resolved_to.label).toBe('Bistro X');
    expect(d.resolved_subject.label).toBe('Tickets');
    expect(d.from_person_first).toBeUndefined();
    expect(d.to_business_name).toBeUndefined();
  });
});

// ── deriveCustody ───────────────────────────────────────────────────────────

describe('deriveCustody', () => {
  const mk = (id, type, occurred, to) => ({
    id, transaction_type: type, occurred_on: occurred,
    resolved_from: null, resolved_to: to, value: null, currency: null,
  });

  test('current holder is the latest to_ party', () => {
    const txns = [
      mk(1, 'acquisition', '2025-01-01', { type: 'person', id: 1, label: 'A' }),
      mk(2, 'transfer', '2025-06-01', { type: 'person', id: 2, label: 'B' }),
    ];
    const { currentHolder, chain } = deriveCustody(txns);
    expect(currentHolder.label).toBe('B');
    expect(chain).toHaveLength(2);
  });

  test('ownershipTypes filter ignores non-ownership transactions', () => {
    const txns = [
      mk(1, 'sale', '2025-01-01', { type: 'person', id: 1, label: 'A' }),
      mk(2, 'visit', '2025-06-01', { type: 'person', id: 9, label: 'Visitor' }),
    ];
    const { currentHolder } = deriveCustody(txns, ['sale', 'purchase', 'transfer', 'acquisition']);
    expect(currentHolder.label).toBe('A');
  });
});

// ── geocodeFields ───────────────────────────────────────────────────────────

describe('geocodeFields', () => {
  test('returns coords on success', async () => {
    const service = { geocodeAddress: async () => ({ lat: 1.1, lng: 2.2, confidence: 80, provider: 'nominatim' }) };
    const r = await geocodeFields(service, { city: 'Paris', country: 'France' });
    expect(r.latitude).toBe(1.1);
    expect(r.geocode_confidence).toBe(80);
    expect(r.geocode_failure).toBeNull();
  });
  test('returns failure reason when geocoding fails', async () => {
    const service = { geocodeAddress: async () => ({ failure: 'not_found' }) };
    const r = await geocodeFields(service, { city: 'Nowhere' });
    expect(r.latitude).toBeNull();
    expect(r.geocode_failure).toBe('not_found');
  });
  test('empty when no address parts', async () => {
    const r = await geocodeFields({ geocodeAddress: async () => ({}) }, {});
    expect(r.geocode_failure).toBe('empty');
  });
});

// ── aggregateVenueStats ─────────────────────────────────────────────────────

describe('aggregateVenueStats', () => {
  test('counts distinct people and ranks by event count', () => {
    const rows = [
      { id: 1, transaction_type: 'benefit', occurred_on: '2025-01-01', to_person_id: 1, to_person_first: 'A', to_person_last: '' },
      { id: 2, transaction_type: 'benefit', occurred_on: '2025-02-01', to_person_id: 1, to_person_first: 'A', to_person_last: '' },
      { id: 3, transaction_type: 'visit', occurred_on: '2025-03-01', to_person_id: 2, to_person_first: 'B', to_person_last: '' },
    ];
    const stats = aggregateVenueStats(rows);
    expect(stats.event_count).toBe(3);
    expect(stats.distinct_people).toBe(2);
    expect(stats.people[0].id).toBe(1);
    expect(stats.people[0].event_count).toBe(2);
    expect(stats.by_type).toEqual({ benefit: 2, visit: 1 });
    expect(stats.first_event).toBe('2025-01-01');
    expect(stats.last_event).toBe('2025-03-01');
  });
});

// ── deriveLedger ────────────────────────────────────────────────────────────

describe('deriveLedger', () => {
  test('person received: value_in and received role', () => {
    const rows = [{
      id: 1, transaction_type: 'benefit', occurred_on: '2025-03-04',
      to_person_id: 12, from_business_id: 5, from_business_name: 'Bistro X',
      item_label: 'Dinner', value: '100.00', currency: 'USD',
    }];
    const { entries, summary } = deriveLedger('person', 12, rows);
    expect(entries[0].role).toBe('received');
    expect(entries[0].value_direction).toBe('in');
    expect(entries[0].counterparty.label).toBe('Bistro X');
    expect(summary.value_in).toBe(100);
    expect(summary.value_out).toBe(0);
    expect(summary.net).toBe(100);
    expect(summary.distinct_counterparties).toBe(1);
  });

  test('person gave with asset subject emits gave + released_custody', () => {
    const rows = [{
      id: 2, transaction_type: 'transfer', occurred_on: '2025-04-01',
      from_person_id: 12, to_person_id: 13, to_person_first: 'B', to_person_last: '',
      subject_asset_id: 3, subject_asset_name: 'Rolex',
    }];
    const { entries, summary } = deriveLedger('person', 12, rows);
    const roles = entries.map(e => e.role);
    expect(roles).toContain('gave');
    expect(roles).toContain('released_custody');
    expect(summary.value_out).toBe(0);
  });

  test('mixed currencies produce null net and by_currency breakdown', () => {
    const rows = [
      { id: 1, transaction_type: 'donation', occurred_on: '2025-01-01', to_person_id: 1, value: '100', currency: 'USD' },
      { id: 2, transaction_type: 'donation', occurred_on: '2025-02-01', to_person_id: 1, value: '50', currency: 'EUR' },
    ];
    const { summary } = deriveLedger('person', 1, rows);
    expect(summary.net).toBeNull();
    expect(summary.by_currency).toHaveLength(2);
  });

  test('business as venue gets a neutral venue entry', () => {
    const rows = [{
      id: 9, transaction_type: 'benefit', occurred_on: '2025-05-01',
      location_business_id: 5, from_business_id: 8, from_business_name: 'Host', to_person_id: 1, to_person_first: 'P', to_person_last: '',
      value: '40', currency: 'USD',
    }];
    const { entries } = deriveLedger('business', 5, rows);
    expect(entries[0].role).toBe('venue');
    expect(entries[0].value_direction).toBe('neutral');
  });
});
