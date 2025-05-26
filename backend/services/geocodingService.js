// File: backend/services/geocodingService.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Cache for geocoding results to avoid hitting the API too often
const geocodeCache = new Map();

// Geocode a single address
async function geocodeAddress(address) {
  if (!address || address.trim() === '') {
    return null;
  }

  // Check cache first
  const cacheKey = address.toLowerCase().trim();
  if (geocodeCache.has(cacheKey)) {
    console.log(`Geocoding cache hit for: ${cacheKey}`);
    return geocodeCache.get(cacheKey);
  }

  try {
    console.log(`Geocoding address: ${address}`);
    const query = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'OSINT-CRM/1.0 (https://github.com/yourusername/osint-crm)' // Update this
      }
    });

    if (!response.ok) {
      console.error(`Geocoding API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
      
      console.log(`Geocoded successfully: ${address} -> ${result.lat}, ${result.lng}`);
      
      // Cache the result
      geocodeCache.set(cacheKey, result);
      
      return result;
    }
    
    console.log(`No results found for address: ${address}`);
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// Batch geocode multiple locations with rate limiting
async function batchGeocode(locations, delay = 1500) { // Increased delay to be safer
  const results = [];
  
  for (const location of locations) {
    const addressParts = [
      location.address,
      location.city,
      location.state,
      location.country
    ].filter(Boolean).join(', ');
    
    if (!addressParts.trim()) {
      results.push(location);
      continue;
    }
    
    const coords = await geocodeAddress(addressParts);
    
    results.push({
      ...location,
      latitude: coords?.lat || location.latitude,
      longitude: coords?.lng || location.longitude
    });
    
    // Rate limiting - only wait if we actually made an API call (not cached)
    if (coords && !geocodeCache.has(addressParts.toLowerCase().trim())) {
      console.log(`Waiting ${delay}ms before next geocoding request...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return results;
}

module.exports = {
  geocodeAddress,
  batchGeocode
};