// Regression tests for schemas.js — real form payloads, not just happy paths.
// Edit forms send null for every cleared field; HTML selects send numeric
// strings; empty inputs send ''.

const {
  TransactionUpdateSchema,
  BusinessUpdateSchema,
  PersonUpdateSchema,
  AssetCreateSchema,
  AssetUpdateSchema,
  PropertyCreateSchema,
} = require('./schemas');

describe('schemas — form-shaped payloads', () => {
  test('transaction edit payload with nulls and string id parses (bug: adjust item failed)', () => {
    // Exactly what AddEditTransactionForm sends when editing an item-subject gift
    const payload = {
      transaction_type: 'gift',
      from_person_id: null,
      from_business_id: null,
      from_external: 'Test Donor',
      to_person_id: '5', // <select> values are strings
      to_business_id: null,
      to_external: null,
      subject_asset_id: null,
      subject_business_id: null,
      subject_property_id: null,
      item_label: 'test watch ADJUSTED',
      item_category: null,
      value: null,
      currency: null,
      occurred_on: null,
      location_business_id: null,
      location_property_id: null,
      location_name: null,
      address: null,
      city: null,
      state: null,
      country: null,
      postal_code: null,
      case_id: null,
      notes: null,
    };
    const result = TransactionUpdateSchema.safeParse(payload);
    expect(result.success).toBe(true);
    expect(result.data.to_person_id).toBe(5); // coerced to number
    expect(result.data.item_label).toBe('test watch ADJUSTED');
  });

  test('numeric strings are coerced, garbage strings are rejected', () => {
    const ok = TransactionUpdateSchema.safeParse({ transaction_type: 'gift', value: '150.50' });
    expect(ok.success).toBe(true);
    expect(ok.data.value).toBe(150.5);

    const bad = TransactionUpdateSchema.safeParse({ transaction_type: 'gift', value: 'lots' });
    expect(bad.success).toBe(false);

    const negative = TransactionUpdateSchema.safeParse({ transaction_type: 'gift', value: '-5' });
    expect(negative.success).toBe(false);
  });

  test('empty string numbers become null', () => {
    const result = TransactionUpdateSchema.safeParse({ transaction_type: 'gift', value: '' });
    expect(result.success).toBe(true);
    expect(result.data.value).toBeNull();
  });

  test('business edit payload with nulls and string owner id parses', () => {
    const result = BusinessUpdateSchema.safeParse({
      name: 'Bistro X',
      type: null,
      email: null,
      website: '',
      phone: null,
      owner_person_id: '3',
      latitude: '48.85',
      longitude: null,
      registration_date: null,
      employees: null, // cleared list → []
    });
    expect(result.success).toBe(true);
    expect(result.data.owner_person_id).toBe(3);
    expect(result.data.latitude).toBeCloseTo(48.85);
    expect(result.data.employees).toEqual([]);
  });

  test('person update with null optionals parses', () => {
    const result = PersonUpdateSchema.safeParse({
      firstName: 'Jane',
      lastName: null,
      dateOfBirth: null,
      notes: null,
      aliases: null,
      locations: null,
    });
    expect(result.success).toBe(true);
    expect(result.data.aliases).toEqual([]);
  });

  test('asset update with null location_mode falls back to default', () => {
    const result = AssetUpdateSchema.safeParse({ name: 'Rolex', location_mode: null });
    expect(result.success).toBe(true);
  });

  test('initial_holder survives asset create parse (bug: holder silently dropped)', () => {
    // Zod strips unknown fields, so initial_holder must be declared in the
    // schema or the acquisition transaction is never seeded.
    const result = AssetCreateSchema.safeParse({
      name: 'Rolex',
      initial_holder: { person_id: '5', business_id: null, external: null, occurred_on: '2026-07-01' },
    });
    expect(result.success).toBe(true);
    expect(result.data.initial_holder.person_id).toBe(5);
  });

  test('invalid dates and out-of-range coordinates still rejected', () => {
    expect(
      PropertyCreateSchema.safeParse({ name: 'Parcel 9', latitude: '123' }).success
    ).toBe(false);
    expect(
      TransactionUpdateSchema.safeParse({ transaction_type: 'gift', occurred_on: 'not-a-date' }).success
    ).toBe(false);
  });

  test('required fields still enforced', () => {
    expect(TransactionUpdateSchema.safeParse({ transaction_type: '' }).success).toBe(false);
    expect(BusinessUpdateSchema.safeParse({ name: null }).success).toBe(false);
  });
});
