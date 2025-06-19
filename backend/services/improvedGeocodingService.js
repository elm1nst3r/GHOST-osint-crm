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
        result.country || null, result.provider || 'nominatim'
      ]);
    } catch (error) {
      console.error('Error caching coordinates:', error);
    }
  }

  // Multiple geocoding providers for better coverage
  async geocodeWithNominatim(address) {
    try {
      const query = encodeURIComponent(address);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=5&addressdetails=1`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'GHOST-OSINT-CRM/2.0 (OSINT Investigation Tool)'
        }
      });

      if (!response.ok) return null;
      const data = await response.json();
      
      if (data && data.length > 0) {
        const best = data[0];
        return {
          lat: parseFloat(best.lat),
          lng: parseFloat(best.lon),
          confidence: this.calculateConfidence(best, address),
          city: best.address?.city || best.address?.town || best.address?.village,
          state: best.address?.state || best.address?.region,
          country: best.address?.country_code?.toUpperCase(),
          provider: 'nominatim',
          alternatives: data.slice(1, 3).map(alt => ({
            lat: parseFloat(alt.lat),
            lng: parseFloat(alt.lon),
            display_name: alt.display_name
          }))
        };
      }
    } catch (error) {
      console.error('Nominatim geocoding error:', error);
    }
    return null;
  }

  // Calculate confidence score based on address matching
  calculateConfidence(result, originalAddress) {
    if (!result.display_name || !originalAddress) return 30;
    
    const original = originalAddress.toLowerCase();
    const returned = result.display_name.toLowerCase();
    
    let score = 50; // Base score
    
    // Check for exact components
    const originalWords = original.split(/[\s,]+/).filter(w => w.length > 2);
    const returnedWords = returned.split(/[\s,]+/);
    
    const matches = originalWords.filter(word => 
      returnedWords.some(rword => rword.includes(word) || word.includes(rword))
    );
    
    score += (matches.length / originalWords.length) * 40;
    
    // Penalty for very generic addresses
    if (result.class === 'place' && result.type === 'village') score -= 10;
    if (result.importance) score += result.importance * 10;
    
    return Math.min(100, Math.max(0, Math.round(score)));
  }

  // Smart geocoding with fallbacks and validation
  async geocodeAddress(address, options = {}) {
    if (!address || address.trim() === '') return null;

    const normalizedAddress = address.trim();
    
    // Check cache first
    let cached = await this.getCachedCoordinates(normalizedAddress);
    if (cached && cached.confidence > (options.minConfidence || 30)) {
      return cached;
    }

    // Try geocoding with rate limiting
    await this.rateLimitDelay();
    
    let result = await this.geocodeWithNominatim(normalizedAddress);
    
    if (!result) {
      // Try with simplified address if no results
      const simplified = this.simplifyAddress(normalizedAddress);
      if (simplified !== normalizedAddress) {
        await this.rateLimitDelay();
        result = await this.geocodeWithNominatim(simplified);
      }
    }

    if (result && result.confidence > (options.minConfidence || 30)) {
      // Cache the result
      await this.cacheCoordinates(normalizedAddress, result);
      return result;
    }

    return null;
  }

  // Simplify address for better matching
  simplifyAddress(address) {
    return address
      .replace(/\b(apt|apartment|unit|ste|suite|#)\s*\d+.*$/i, '') // Remove apartment numbers
      .replace(/\b\d+[a-z]?\s+(st|nd|rd|th)\s+/i, '') // Remove ordinal street numbers
      .replace(/\s+floor\s*\d+.*$/i, '') // Remove floor numbers
      .trim();
  }

  // Rate limiting for API calls
  async rateLimitDelay() {
    const delay = 1000; // 1 second between calls
    await new Promise(resolve => setTimeout(resolve, delay));
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
        
        // If full address fails and we have city+country, try that as fallback
        if (!coords && location.city && location.country) {
          const cityCountry = [location.city, location.country].join(', ');
          coords = await this.geocodeAddress(cityCountry, { ...options, minConfidence: 25 });
          if (coords) {
            coords.confidence = Math.max(25, coords.confidence - 15); // Lower confidence for city-level
          }
        }
        
        // If still no results and we have just country, try country-level
        if (!coords && location.country && !location.city) {
          coords = await this.geocodeAddress(location.country, { ...options, minConfidence: 20 });
          if (coords) {
            coords.confidence = Math.max(20, coords.confidence - 25); // Even lower confidence for country-level
          }
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

  // Address suggestions for autocomplete
  async getSuggestions(query, limit = 5) {
    if (!query || query.length < 3) return [];
    
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=${limit}&addressdetails=1`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'GHOST-OSINT-CRM/2.0 (OSINT Investigation Tool)'
        }
      });

      if (!response.ok) return [];
      const data = await response.json();
      
      return data.map(item => ({
        display_name: item.display_name,
        address: {
          street: item.address?.house_number && item.address?.road ? 
            `${item.address.house_number} ${item.address.road}` : item.address?.road,
          city: item.address?.city || item.address?.town || item.address?.village,
          state: item.address?.state || item.address?.region,
          country: item.address?.country,
          postal_code: item.address?.postcode
        },
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        confidence: this.calculateConfidence(item, query)
      })).sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      console.error('Error getting address suggestions:', error);
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