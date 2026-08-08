import {
  EDGE_LAYERS,
  DEFAULT_EDGE_LAYERS,
  layerForType,
  typesInLayer,
  isTypeVisible,
} from './edgeLayers';

describe('layerForType', () => {
  test('groups governance ties together', () => {
    expect(layerForType('owner')).toBe('governance');
    expect(layerForType('owns_business')).toBe('governance');
    expect(layerForType('board_member')).toBe('governance');
  });

  test('keeps employment separate from governance', () => {
    expect(layerForType('employee')).toBe('employment');
    expect(layerForType('employer')).toBe('employment');
  });

  test('maps the remaining known types', () => {
    expect(layerForType('transaction')).toBe('financial');
    expect(layerForType('family')).toBe('social');
    expect(layerForType('suspect')).toBe('investigative');
  });

  test('falls back to other so a custom type is never invisible', () => {
    expect(layerForType('some_user_defined_type')).toBe('other');
    expect(layerForType(undefined)).toBe('other');
    expect(layerForType(null)).toBe('other');
  });
});

describe('layer coverage', () => {
  test('every layer in EDGE_LAYERS has types, and every type maps back', () => {
    EDGE_LAYERS.forEach((layer) => {
      const types = typesInLayer(layer);
      expect(types.length).toBeGreaterThan(0);
      types.forEach((type) => expect(layerForType(type)).toBe(layer));
    });
  });

  test('DEFAULT_EDGE_LAYERS has an entry for every layer', () => {
    EDGE_LAYERS.forEach((layer) => {
      expect(DEFAULT_EDGE_LAYERS).toHaveProperty(layer);
    });
  });
});

describe('isTypeVisible', () => {
  test('respects the per-layer toggles', () => {
    const layers = { ...DEFAULT_EDGE_LAYERS, social: false };
    expect(isTypeVisible('family', layers)).toBe(false);
    expect(isTypeVisible('owner', layers)).toBe(true);
  });

  test('financial is off by default — transaction edges are dense', () => {
    expect(isTypeVisible('transaction', DEFAULT_EDGE_LAYERS)).toBe(false);
  });

  test('solo shows only that layer, overriding the toggles', () => {
    const allOn = EDGE_LAYERS.reduce((acc, l) => ({ ...acc, [l]: true }), {});
    expect(isTypeVisible('board_member', allOn, 'governance')).toBe(true);
    expect(isTypeVisible('owns_business', allOn, 'governance')).toBe(true);
    expect(isTypeVisible('family', allOn, 'governance')).toBe(false);
    expect(isTypeVisible('employee', allOn, 'governance')).toBe(false);
  });

  test('solo overrides a layer that is toggled off', () => {
    const allOff = EDGE_LAYERS.reduce((acc, l) => ({ ...acc, [l]: false }), {});
    expect(isTypeVisible('transaction', allOff, 'financial')).toBe(true);
  });

  test('the conflict-of-interest view: governance + financial only', () => {
    const layers = {
      governance: true, financial: true,
      employment: false, social: false, investigative: false, other: false,
    };
    expect(isTypeVisible('board_member', layers)).toBe(true);
    expect(isTypeVisible('owns_business', layers)).toBe(true);
    expect(isTypeVisible('transaction', layers)).toBe(true);
    expect(isTypeVisible('friend', layers)).toBe(false);
    expect(isTypeVisible('employee', layers)).toBe(false);
  });

  test('defaults to visible when a layer key is missing entirely', () => {
    expect(isTypeVisible('family', {})).toBe(true);
  });
});
