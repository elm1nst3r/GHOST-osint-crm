const {
  PROVIDERS, PROVIDER_IDS, DEFAULT_PROVIDER,
  isValidProvider, getProvider, apiKeySettingKey,
} = require('./geocodingProviders');

describe('provider registry', () => {
  test('every provider is internally consistent', () => {
    PROVIDER_IDS.forEach((id) => {
      const p = PROVIDERS[id];
      expect(p.id).toBe(id);
      expect(typeof p.requiresKey).toBe('boolean');
      expect(p.minIntervalMs).toBeGreaterThan(0);
    });
  });

  test('the default provider needs no API key', () => {
    // Otherwise a fresh install could not geocode until configured.
    expect(PROVIDERS[DEFAULT_PROVIDER].requiresKey).toBe(false);
  });

  test('Nominatim is throttled to its documented 1 req/s limit', () => {
    // Exceeding it gets the whole instance blocked (issue #57).
    expect(PROVIDERS.nominatim.minIntervalMs).toBeGreaterThanOrEqual(1000);
  });

  test('keyed providers are not throttled to the public endpoint rate', () => {
    PROVIDER_IDS.filter((id) => PROVIDERS[id].requiresKey).forEach((id) => {
      expect(PROVIDERS[id].minIntervalMs).toBeLessThan(1000);
    });
  });
});

describe('isValidProvider / getProvider', () => {
  test('accepts every registered id', () => {
    PROVIDER_IDS.forEach((id) => expect(isValidProvider(id)).toBe(true));
  });

  test('rejects anything unregistered', () => {
    ['google', '', null, undefined, 'toString', '__proto__'].forEach((id) =>
      expect(isValidProvider(id)).toBe(false)
    );
  });

  test('falls back to the default rather than returning undefined', () => {
    expect(getProvider('nonsense').id).toBe(DEFAULT_PROVIDER);
    expect(getProvider(undefined).id).toBe(DEFAULT_PROVIDER);
  });
});

describe('apiKeySettingKey', () => {
  test('namespaces per provider so keys survive switching', () => {
    expect(apiKeySettingKey('yandex')).toBe('geocoding_api_key_yandex');
    expect(apiKeySettingKey('locationiq')).toBe('geocoding_api_key_locationiq');
  });

  test('produces a distinct key for every provider', () => {
    const keys = PROVIDER_IDS.map(apiKeySettingKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
