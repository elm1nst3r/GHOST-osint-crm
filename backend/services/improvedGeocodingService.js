// File: backend/services/improvedGeocodingService.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const {
  PROVIDER_IDS, DEFAULT_PROVIDER, isValidProvider, getProvider, apiKeySettingKey,
} = require('./geocodingProviders');

class ImprovedGeocodingService {
  constructor(pool) {
    this.pool = pool;
    // One request queue per provider. Each has its own rate limit, so they
    // must not share a chain — Nominatim's public endpoint allows at most 1
    // request/second and exceeding it blocks the whole instance (issue #57),
    // while a paid provider shouldn't be throttled to that.
    this.queues = {};
    this.providerConfig = { provider: DEFAULT_PROVIDER, apiKeys: {} };
    this.initializeDatabase();
  }

  // Serialize + space this provider's requests, queue-ordered.
  throttledFetch(providerId, url, options) {
    const { minIntervalMs } = getProvider(providerId);
    const queue = this.queues[providerId] || (this.queues[providerId] = { chain: Promise.resolve(), lastAt: 0 });
    const run = async () => {
      const wait = queue.lastAt + minIntervalMs - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      queue.lastAt = Date.now();
      return this.fetchWithTimeout(url, options);
    };
    const request = queue.chain.then(run, run);
    queue.chain = request.catch(() => {});
    return request;
  }

  async initializeDatabase() {
    try {
      // Create geocoding cache table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS geocoding_cache (
          id SERIAL PRIMARY KEY,
          address_hash VARCHAR(64) NOT NULL,
          original_address TEXT NOT NULL,
          normalized_address TEXT NOT NULL,
          latitude DECIMAL(10, 8),
          longitude DECIMAL(11, 8),
          confidence_score INTEGER DEFAULT 0,
          provider VARCHAR(50) NOT NULL DEFAULT 'nominatim',
          country_code VARCHAR(2),
          city VARCHAR(100),
          state VARCHAR(100),
          postal_code VARCHAR(20),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create index for faster lookups
      await this.pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS geocoding_cache_hash_provider_key ON geocoding_cache(address_hash, provider);
        CREATE INDEX IF NOT EXISTS idx_geocoding_cache_hash ON geocoding_cache(address_hash);
        CREATE INDEX IF NOT EXISTS idx_geocoding_cache_address ON geocoding_cache(normalized_address);
      `);

      console.log('Geocoding cache database initialized');
    } catch (error) {
      console.error('Error initializing geocoding cache:', error);
    }
  }

  // Create a hash for address caching
  createAddressHash(address) {
    const crypto = require('crypto');
    const normalized = this.normalizeAddress(address);
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  // Normalize address for better matching
  normalizeAddress(address) {
    if (!address) return '';
    return address.toLowerCase()
      .replace(/[^\w\s,.-]/g, '') // Remove special chars except common ones
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\b(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|court|ct|place|pl)\b/g, '$1') // Normalize street types
      .trim();
  }

  // Check database cache first
  async getCachedCoordinates(address, provider) {
    const hash = this.createAddressHash(address);
    try {
      const result = await this.pool.query(
        `SELECT latitude, longitude, confidence_score, city, state, country_code
         FROM geocoding_cache WHERE address_hash = $1 AND provider = $2`,
        [hash, provider]
      );
      
      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          lat: parseFloat(row.latitude),
          lng: parseFloat(row.longitude),
          confidence: row.confidence_score,
          city: row.city,
          state: row.state,
          country: row.country_code,
          cached: true
        };
      }
    } catch (error) {
      console.error('Error checking cache:', error);
    }
    return null;
  }

  // Cache coordinates in database
  async cacheCoordinates(address, result) {
    const hash = this.createAddressHash(address);
    const normalized = this.normalizeAddress(address);
    
    try {
      await this.pool.query(`
        INSERT INTO geocoding_cache 
        (address_hash, original_address, normalized_address, latitude, longitude, confidence_score, city, state, country_code, provider)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (address_hash, provider)
        DO UPDATE SET
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          confidence_score = EXCLUDED.confidence_score,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          country_code = EXCLUDED.country_code,
          updated_at = CURRENT_TIMESTAMP
      `, [
        hash, address, normalized, result.lat, result.lng, 
        result.confidence || 50, result.city || null, result.state || null,
        result.country || null, result.provider || 'nominatim'
      ]);
    } catch (error) {
      console.error('Error caching coordinates:', error);
    }
  }

  // Geocode using Nominatim (public OSM geocoding service)
  async geocodeWithNominatim(address, isRetry = false) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=5&addressdetails=1`;

      const response = await this.throttledFetch('nominatim', url, {
        headers: { 'User-Agent': 'GHOST-OSINT-CRM/2.4 (https://github.com/elm1nst3r/GHOST-osint-crm)' }
      });

      if (response.status === 429) {
        // Provider-side rate limit. Retry once after backing off — with the
        // request queue above this should only happen after earlier bursts.
        if (!isRetry) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return this.geocodeWithNominatim(address, true);
        }
        return {
          failure: 'rate_limited',
          message: 'The geocoding provider is rate limiting requests — wait a few seconds and try again',
        };
      }

      if (!response.ok) {
        return { failure: 'service_error', message: `Geocoding service returned ${response.status}` };
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        return { failure: 'not_found', message: 'No results found for this address' };
      }

      return { ...this.parseNominatimShape(data, address), provider: 'nominatim' };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { failure: 'timeout', message: 'Geocoding request timed out — check your connection or try a simpler address' };
      }
      return { failure: 'service_error', message: 'Geocoding service is unreachable' };
    }
  }

  // ── LocationIQ ─────────────────────────────────────────────────────────
  // Commercial geocoding built on the same OSM data as Nominatim but without
  // its rate limits, and — unlike some commercial providers — with no
  // restriction on which basemap the results are drawn on, which matters
  // because GHOST renders on OpenStreetMap tiles.
  //
  // Its search response is Nominatim-shaped, so the parsing and confidence
  // scoring are shared rather than duplicated.
  // Providers explain *why* they rejected a key — "Invalid key", "key not
  // active", "wrong API type" all need different fixes from the operator. The
  // first version of this swallowed that and substituted a generic message,
  // which made a real report impossible to diagnose. Never include the URL:
  // it carries the API key.
  async providerErrorDetail(response) {
    try {
      const text = await response.text();
      if (!text) return '';
      try {
        const body = JSON.parse(text);
        const detail = body.message || body.error?.message || body.error || body.statusCode;
        return detail ? String(detail).slice(0, 200) : '';
      } catch {
        return text.slice(0, 200);
      }
    } catch {
      return '';
    }
  }

  async geocodeWithLocationIQ(address, apiKey) {
    if (!apiKey) {
      return { failure: 'service_error', message: 'LocationIQ is enabled but no API key is configured' };
    }
    try {
      const url = `https://us1.locationiq.com/v1/search?key=${encodeURIComponent(apiKey)}`
        + `&q=${encodeURIComponent(address)}&format=json&limit=5&addressdetails=1`;

      const response = await this.throttledFetch('locationiq', url, {});

      if (response.status === 401 || response.status === 403) {
        const detail = await this.providerErrorDetail(response);
        console.error(`LocationIQ rejected the request (${response.status}): ${detail || 'no detail returned'}`);
        return {
          failure: 'service_error',
          message: detail
            ? `LocationIQ rejected the request: ${detail}. Check the key in Settings.`
            : 'LocationIQ rejected the API key — check it in Settings.',
        };
      }
      if (response.status === 429) {
        return { failure: 'rate_limited', message: 'LocationIQ is rate limiting requests — wait a few seconds and try again' };
      }
      // LocationIQ signals "no match" with 404 rather than an empty array.
      if (response.status === 404) {
        return { failure: 'not_found', message: 'No results found for this address' };
      }
      if (!response.ok) {
        return { failure: 'service_error', message: `LocationIQ returned ${response.status}` };
      }

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        return { failure: 'not_found', message: 'No results found for this address' };
      }
      return { ...this.parseNominatimShape(data, address), provider: 'locationiq' };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { failure: 'timeout', message: 'Geocoding request timed out — check your connection or try a simpler address' };
      }
      return { failure: 'service_error', message: 'LocationIQ is unreachable' };
    }
  }

  // ── Yandex Geocoder (issue #62) ────────────────────────────────────────
  // Opt-in alternative provider. Nominatim's coverage of informal Russian
  // address forms ("г. Котельники мкр. Южный д. 3Б") is poor, and Yandex is
  // far better for those. Requires an operator-supplied API key, configured in
  // Settings — it is never enabled by default and never used without a key.
  //
  async geocodeWithYandex(address, apiKey) {
    if (!apiKey) {
      return { failure: 'service_error', message: 'Yandex geocoding is enabled but no API key is configured' };
    }
    try {
      const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${encodeURIComponent(apiKey)}`
        + `&geocode=${encodeURIComponent(address)}&format=json&results=5`;

      const response = await this.throttledFetch('yandex', url, {});

      if (response.status === 403 || response.status === 401) {
        const detail = await this.providerErrorDetail(response);
        console.error(`Yandex geocoding rejected the request (${response.status}): ${detail || 'no detail returned'}`);
        return {
          failure: 'service_error',
          message: detail
            ? `Yandex rejected the request: ${detail}. Check the key in Settings — it must be a key for the Geocoder HTTP API, and it must be activated.`
            : 'Yandex rejected the API key. Check that it is a key for the Geocoder HTTP API (not the JavaScript API) and that it has been activated.',
        };
      }
      if (response.status === 429) {
        return { failure: 'rate_limited', message: 'Yandex is rate limiting requests — wait a few seconds and try again' };
      }
      if (!response.ok) {
        const detail = await this.providerErrorDetail(response);
        console.error(`Yandex geocoding returned ${response.status}: ${detail || 'no detail returned'}`);
        return {
          failure: 'service_error',
          message: detail ? `Yandex geocoding returned ${response.status}: ${detail}` : `Yandex geocoding returned ${response.status}`,
        };
      }

      const data = await response.json();
      const members = data?.response?.GeoObjectCollection?.featureMember;
      if (!Array.isArray(members) || members.length === 0) {
        return { failure: 'not_found', message: 'No results found for this address' };
      }

      const parse = (member) => {
        const obj = member?.GeoObject;
        if (!obj) return null;
        // Yandex returns "longitude latitude" — the opposite order to almost
        // everything else. Getting this backwards puts every pin in the sea.
        const [lonStr, latStr] = String(obj.Point?.pos || '').split(' ');
        const lat = parseFloat(latStr);
        const lng = parseFloat(lonStr);
        if (!isFinite(lat) || !isFinite(lng)) return null;
        const meta = obj.metaDataProperty?.GeocoderMetaData;
        const components = meta?.Address?.Components || [];
        const pick = (kind) => components.find((c) => c.kind === kind)?.name;
        return {
          lat,
          lng,
          precision: meta?.precision,
          city: pick('locality'),
          state: pick('province'),
          country: meta?.Address?.country_code,
          displayName: meta?.text || obj.name,
        };
      };

      const parsed = members.map(parse).filter(Boolean);
      if (parsed.length === 0) {
        return { failure: 'not_found', message: 'No results found for this address' };
      }

      const best = parsed[0];
      return {
        lat: best.lat,
        lng: best.lng,
        confidence: this.calculateYandexConfidence(best.precision),
        city: best.city,
        state: best.state,
        country: best.country ? String(best.country).toUpperCase() : undefined,
        displayName: best.displayName,
        provider: 'yandex',
        alternatives: parsed.slice(1, 4).map((alt) => ({
          lat: alt.lat, lng: alt.lng, display_name: alt.displayName,
        })),
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { failure: 'timeout', message: 'Geocoding request timed out — check your connection or try a simpler address' };
      }
      return { failure: 'service_error', message: 'Yandex geocoding service is unreachable' };
    }
  }

  // Yandex reports match quality as a precision band rather than a score.
  calculateYandexConfidence(precision) {
    switch (precision) {
      case 'exact':  return 95;  // exact house
      case 'number': return 88;  // house number approximated
      case 'near':   return 75;  // nearby house
      case 'range':  return 70;  // within a house-number range
      case 'street': return 60;  // street only
      case 'other':  return 40;
      default:       return 50;
    }
  }

  // Shared by Nominatim and LocationIQ — LocationIQ returns the same shape.
  parseNominatimShape(data, address) {
    const best = data[0];
    return {
      lat: parseFloat(best.lat),
      lng: parseFloat(best.lon),
      confidence: this.calculateNominatimConfidence(best, address),
      city: best.address?.city || best.address?.town || best.address?.village,
      state: best.address?.state || best.address?.region,
      country: best.address?.country_code?.toUpperCase(),
      displayName: best.display_name,
      alternatives: data.slice(1, 4).map((alt) => ({
        lat: parseFloat(alt.lat),
        lng: parseFloat(alt.lon),
        display_name: alt.display_name,
      })),
    };
  }

  // Calculate confidence from Nominatim result
  calculateNominatimConfidence(result, originalAddress) {
    if (!result.display_name || !originalAddress) return 30;
    const original = originalAddress.toLowerCase();
    const returned = result.display_name.toLowerCase();
    let score = 50;
    const originalWords = original.split(/[\s,]+/).filter(w => w.length > 2);
    const returnedWords = returned.split(/[\s,]+/);
    const matches = originalWords.filter(word =>
      returnedWords.some(rword => rword.includes(word) || word.includes(rword))
    );
    score += (matches.length / Math.max(originalWords.length, 1)) * 40;
    if (result.importance) score += result.importance * 10;
    return Math.min(100, Math.max(0, Math.round(score)));
  }


  // Smart geocoding with failure reason propagation
  // Operator config lives in app_settings so it survives a browser and is
  // readable by the backend, which is what actually calls the provider.
  // Cached for a few seconds so a batch geocode doesn't hammer the table.
  async getProviderConfig() {
    const now = Date.now();
    if (this.providerConfigAt && now - this.providerConfigAt < 5000) {
      return this.providerConfig;
    }
    const keyNames = PROVIDER_IDS.map(apiKeySettingKey);
    try {
      const res = await this.pool.query(
        `SELECT key, value FROM app_settings WHERE key = 'geocoding_provider' OR key = ANY($1)`,
        [keyNames]
      );
      const map = Object.fromEntries(res.rows.map((r) => [r.key, r.value]));
      const apiKeys = {};
      PROVIDER_IDS.forEach((id) => {
        // Env vars remain a fallback so a deployment can supply keys without
        // touching the database.
        apiKeys[id] = map[apiKeySettingKey(id)] || process.env[`${id.toUpperCase()}_API_KEY`] || null;
      });
      const stored = map.geocoding_provider;
      this.providerConfig = {
        provider: isValidProvider(stored) ? stored : DEFAULT_PROVIDER,
        apiKeys,
      };
    } catch {
      // Table missing (pre-migration) or unreadable — fall back to the default
      // provider rather than failing every lookup.
      this.providerConfig = { provider: DEFAULT_PROVIDER, apiKeys: {} };
    }
    this.providerConfigAt = now;
    return this.providerConfig;
  }

  // Force a refresh after Settings changes, so a new key takes effect at once.
  invalidateProviderConfig() {
    this.providerConfigAt = 0;
  }

  // Dispatch to the configured provider. A provider that needs a key but has
  // none falls back to the default, so a half-finished setup degrades instead
  // of breaking every address lookup.
  async geocodeWithProvider(address) {
    const { provider, apiKeys } = await this.getProviderConfig();
    const spec = getProvider(provider);
    const key = apiKeys[provider];
    if (spec.requiresKey && !key) return this.geocodeWithNominatim(address);

    switch (provider) {
      case 'yandex':     return this.geocodeWithYandex(address, key);
      case 'locationiq': return this.geocodeWithLocationIQ(address, key);
      default:           return this.geocodeWithNominatim(address);
    }
  }

  // Which provider will actually serve a request — used for cache keying, so a
  // provider that has silently fallen back doesn't poison the other's cache.
  async getEffectiveProvider() {
    const { provider, apiKeys } = await this.getProviderConfig();
    const spec = getProvider(provider);
    return spec.requiresKey && !apiKeys[provider] ? DEFAULT_PROVIDER : provider;
  }

  async geocodeAddress(address, options = {}) {
    if (!address || address.trim() === '') {
      return { failure: 'empty', message: 'Address is empty' };
    }

    const normalizedAddress = address.trim();
    const minConfidence = options.minConfidence || 30;

    // Check cache first — per provider, or switching provider would keep
    // serving the old one's results (issue #62)
    const activeProvider = await this.getEffectiveProvider();
    const cached = await this.getCachedCoordinates(normalizedAddress, activeProvider);
    if (cached && cached.confidence > minConfidence) {
      return cached;
    }

    let result = await this.geocodeWithProvider(normalizedAddress);

    // If the service failed (timeout/error), return the failure immediately
    if (result && result.failure && result.failure !== 'not_found') {
      return result;
    }

    // If not found, try with simplified address
    if (!result || result.failure === 'not_found') {
      const simplified = this.simplifyAddress(normalizedAddress);
      if (simplified !== normalizedAddress) {
        const simplified_result = await this.geocodeWithProvider(simplified);
        if (simplified_result && !simplified_result.failure) {
          result = simplified_result;
        }
      }
    }

    // Still no result
    if (!result || result.failure) {
      return result || { failure: 'not_found', message: 'No results found for this address' };
    }

    // Result found but confidence too low
    if (result.confidence <= minConfidence) {
      return {
        failure: 'low_confidence',
        message: `Match found but confidence is too low (${result.confidence}%). The address matched to: "${result.displayName}". Try adding more detail such as city or country.`,
        best_match: result
      };
    }

    await this.cacheCoordinates(normalizedAddress, result);
    return result;
  }

  // Simplify address for better matching
  simplifyAddress(address) {
    return address
      .replace(/\b(apt|apartment|unit|ste|suite|#)\s*\d+.*$/i, '') // Remove apartment numbers
      .replace(/\b\d+[a-z]?\s+(st|nd|rd|th)\s+/i, '') // Remove ordinal street numbers
      .replace(/\s+floor\s*\d+.*$/i, '') // Remove floor numbers
      .trim();
  }

  // Batch geocode with smart processing
  async batchGeocode(locations, options = {}) {
    const results = [];
    const maxConcurrent = options.maxConcurrent || 3;
    const chunks = this.chunkArray(locations, maxConcurrent);
    
    for (const chunk of chunks) {
      const promises = chunk.map(async (location) => {
        const addressParts = [
          location.address,
          location.city,
          location.state,
          location.country
        ].filter(Boolean);
        
        if (addressParts.length === 0) return location;
        
        // Try full address first
        const fullAddress = addressParts.join(', ');
        let coords = await this.geocodeAddress(fullAddress, options);
        const primaryFailed = !coords || coords.failure;

        // Fallback to city+country if full address failed (issue #35: check coords.failure, not just !coords)
        if (primaryFailed && location.city && location.country) {
          const cityCountry = [location.city, location.country].join(', ');
          const fallback = await this.geocodeAddress(cityCountry, { ...options, minConfidence: 25 });
          if (fallback && !fallback.failure) {
            coords = { ...fallback, confidence: Math.max(25, fallback.confidence - 15) };
          }
        }

        // Fallback to country-level if city also missing
        if ((!coords || coords.failure) && location.country && !location.city) {
          const fallback = await this.geocodeAddress(location.country, { ...options, minConfidence: 20 });
          if (fallback && !fallback.failure) {
            coords = { ...fallback, confidence: Math.max(20, fallback.confidence - 25) };
          }
        }

        // If all fallbacks failed, keep the most informative failure object for callers
        if (!coords || coords.failure) {
          coords = primaryFailed && coords ? coords : { failure: 'not_found', message: 'No results for any fallback level' };
        }
        
        return {
          ...location,
          latitude: coords?.lat || location.latitude,
          longitude: coords?.lng || location.longitude,
          geocode_confidence: coords?.confidence || 0,
          geocode_provider: coords?.provider || null,
          geocoded_at: coords ? new Date().toISOString() : null
        };
      });
      
      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults);
      
      // Delay between chunks
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    return results;
  }

  // Utility to chunk array
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // Shared helper — fetch with an AbortController timeout (default 8 s)
  async fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  // Address suggestions for autocomplete
  async getSuggestions(query, limit = 5) {
    const config = await this.getProviderConfig();
    const provider = await this.getEffectiveProvider();
    if (provider === 'locationiq') {
      const result = await this.geocodeWithLocationIQ(query, config.apiKeys.locationiq);
      if (result.failure) return [];
      return [
        { lat: result.lat, lng: result.lng, display_name: result.displayName, confidence: result.confidence, provider: 'locationiq' },
        ...(result.alternatives || []).map((a) => ({
          lat: a.lat, lng: a.lng, display_name: a.display_name, provider: 'locationiq',
        })),
      ].slice(0, limit);
    }
    if (provider === 'yandex') {
      const result = await this.geocodeWithYandex(query, config.apiKeys.yandex);
      if (result.failure) return [];
      return [
        { lat: result.lat, lng: result.lng, display_name: result.displayName, confidence: result.confidence, provider: 'yandex' },
        ...(result.alternatives || []).map((a) => ({
          lat: a.lat, lng: a.lng, display_name: a.display_name, provider: 'yandex',
        })),
      ].slice(0, limit);
    }
    return this.getSuggestionsFromNominatim(query, limit);
  }

  async getSuggestionsFromNominatim(query, limit = 5) {
    if (!query || query.length < 3) return [];

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=${limit}&addressdetails=1`;
      const response = await this.throttledFetch('nominatim', url, {
        headers: { 'User-Agent': 'GHOST-OSINT-CRM/2.4 (https://github.com/elm1nst3r/GHOST-osint-crm)' }
      });
      if (!response.ok) return [];
      const data = await response.json();

      return data.map(item => ({
        display_name: item.display_name,
        address: {
          street: item.address?.house_number && item.address?.road
            ? `${item.address.house_number} ${item.address.road}`
            : item.address?.road,
          city: item.address?.city || item.address?.town || item.address?.village,
          state: item.address?.state || item.address?.region,
          country: item.address?.country,
          postal_code: item.address?.postcode
        },
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        confidence: this.calculateNominatimConfidence(item, query)
      })).sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      console.error('Error getting address suggestions:', error.message);
      return [];
    }
  }

  // Get cache statistics
  async getCacheStats() {
    try {
      const stats = await this.pool.query(`
        SELECT 
          COUNT(*) as total_cached,
          COUNT(CASE WHEN latitude IS NOT NULL THEN 1 END) as successful_geocodes,
          AVG(confidence_score) as avg_confidence,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as cached_today
        FROM geocoding_cache
      `);
      
      return stats.rows[0];
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return null;
    }
  }
}

module.exports = ImprovedGeocodingService;