// File: backend/services/geocodingProviders.js
//
// The registry of geocoding providers GHOST can use.
//
// Adding Yandex (issue #62) hardcoded a second provider throughout the service
// — its own queue fields, its own settings key, its own enum entry in two
// files. Adding a third made that pattern obviously wrong, so provider
// differences live here instead and the service treats them uniformly.
//
// To add a provider: add an entry here, add a parse function in the service,
// and add its display strings. Nothing else needs to know it exists.

const PROVIDERS = {
  nominatim: {
    id: 'nominatim',
    requiresKey: false,
    // The public OSM endpoint permits at most 1 request/second; exceeding it
    // gets the whole instance blocked (issue #57).
    minIntervalMs: 1100,
  },
  yandex: {
    id: 'yandex',
    requiresKey: true,
    minIntervalMs: 120,
  },
  locationiq: {
    id: 'locationiq',
    requiresKey: true,
    // Free tier allows ~2 requests/second.
    minIntervalMs: 600,
  },
};

const DEFAULT_PROVIDER = 'nominatim';

const PROVIDER_IDS = Object.keys(PROVIDERS);

const isValidProvider = (id) => Object.prototype.hasOwnProperty.call(PROVIDERS, id);

const getProvider = (id) => PROVIDERS[isValidProvider(id) ? id : DEFAULT_PROVIDER];

// Settings key holding a provider's API key. Namespaced per provider so a key
// isn't lost when switching, and so configuring one doesn't disturb another.
const apiKeySettingKey = (id) => `geocoding_api_key_${id}`;

module.exports = {
  PROVIDERS,
  PROVIDER_IDS,
  DEFAULT_PROVIDER,
  isValidProvider,
  getProvider,
  apiKeySettingKey,
};
