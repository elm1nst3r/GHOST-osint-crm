// File: backend/services/improvedGeocodingService.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

class ImprovedGeocodingService {
  constructor(pool) {
    this.pool = pool;
    this.initializeDatabase();
  }

  async initializeDatabase() {
    try {
      // Create geocoding cache table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS geocoding_cache (
          id SERIAL PRIMARY KEY,
          address_hash VARCHAR(64) UNIQUE NOT NULL,
          original_address TEXT NOT NULL,
          normalized_address TEXT NOT NULL,
          latitude DECIMAL(10, 8),
          longitude DECIMAL(11, 8),
          confidence_score INTEGER DEFAULT 0,
          provider VARCHAR(50) DEFAULT 'nominatim',
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
  async getCachedCoordinates(address) {
    const hash = this.createAddressHash(address);
    try {
      const result = await this.pool.query(
        'SELECT latitude, longitude, confidence_score, city, state, country_code FROM geocoding_cache WHERE address_hash = $1',
        [hash]
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
        ON CONFLICT (address_hash) 
        DO UPDATE SET 
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          confidence_score = EXCLUDED.confidence_score,
          updated_at = CURRENT_TIMESTAMP
      `, [
        hash, address, normalized, result.lat, result.lng, 
        result.confidence || 50, result.city || null, result.state || null,
        result.country || null, result.provider || 'photon'
      ]);
    } catch (error) {
      console.error('Error caching coordinates:', error);
    }
  }

  // Geocode using Nominatim (public OSM geocoding service)
  async geocodeWithNominatim(address) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=5&addressdetails=1`;

      const response = await this.fetchWithTimeout(url, {
        headers: { 'User-Agent': 'GHOST-OSINT-CRM/2.4 (https://github.com/elm1nst3r/GHOST-osint-crm)' }
      });

      if (!response.ok) {
        return { failure: 'service_error', message: `Geocoding service returned ${response.status}` };
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        return { failure: 'not_found', message: 'No results found for this address' };
      }

      const best = data[0];
      return {
        lat: parseFloat(best.lat),
        lng: parseFloat(best.lon),
        confidence: this.calculateNominatimConfidence(best, address),
        city: best.address?.city || best.address?.town || best.address?.village,
        state: best.address?.state || best.address?.region,
        country: best.address?.country_code?.toUpperCase(),
        displayName: best.display_name,
        provider: 'nominatim',
        alternatives: data.slice(1, 4).map(alt => ({
          lat: parseFloat(alt.lat),
          lng: parseFloat(alt.lon),
          display_name: alt.display_name
        }))
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { failure: 'timeout', message: 'Geocoding request timed out — check your connection or try a simpler address' };
      }
      return { failure: 'service_error', message: 'Geocoding service is unreachable' };
    }
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
  async geocodeAddress(address, options = {}) {
    if (!address || address.trim() === '') {
      return { failure: 'empty', message: 'Address is empty' };
    }

    const normalizedAddress = address.trim();
    const minConfidence = options.minConfidence || 30;

    // Check cache first
    const cached = await this.getCachedCoordinates(normalizedAddress);
    if (cached && cached.confidence > minConfidence) {
      return cached;
    }

    let result = await this.geocodeWithNominatim(normalizedAddress);

    // If the service failed (timeout/error), return the failure immediately
    if (result && result.failure && result.failure !== 'not_found') {
      return result;
    }

    // If not found, try with simplified address
    if (!result || result.failure === 'not_found') {
      const simplified = this.simplifyAddress(normalizedAddress);
      if (simplified !== normalizedAddress) {
        const simplified_result = await this.geocodeWithNominatim(simplified);
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
    if (!query || query.length < 3) return [];

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=${limit}&addressdetails=1`;
      const response = await this.fetchWithTimeout(url, {
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