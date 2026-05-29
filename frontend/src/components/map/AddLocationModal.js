import React, { useState, useCallback } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || '/api';

const AddLocationModal = ({ allPeople, onSuccess, onClose }) => {
  const [locationData, setLocationData] = useState({ address: '', personId: null });
  const [suggestions, setSuggestions] = useState([]);

  const getSuggestions = useCallback(async (query) => {
    if (!query || query.length < 3) { setSuggestions([]); return; }
    try {
      const res = await fetch(`${API_BASE}/geocode/suggestions?q=${encodeURIComponent(query)}&limit=5`, { credentials: 'include' });
      if (res.ok) setSuggestions(await res.json());
    } catch { /* silent */ }
  }, []);

  const handleAdd = async () => {
    if (!locationData.address.trim() || !locationData.personId) {
      alert('Please enter an address and select a person');
      return;
    }
    try {
      const geoRes = await fetch(`${API_BASE}/geocode/address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ address: locationData.address, minConfidence: 30 }),
      });

      if (!geoRes.ok) throw new Error('Geocoding request failed');
      const geoResult = await geoRes.json();

      if (!geoResult.success) {
        let msg = geoResult.message || 'Could not geocode this address.';
        if (geoResult.best_match) {
          msg += `\n\nDid you mean: "${geoResult.best_match.displayName}"?\nIf so, try a more complete address.`;
        } else if (geoResult.reason === 'not_found') {
          msg += '\n\nTips:\n• Add a city and country (e.g. "10 Downing St, London, UK")\n• Check for spelling mistakes\n• Try a postcode or zip code instead';
        } else if (geoResult.reason === 'timeout') {
          msg += '\n\nThe geocoding service did not respond. Check your internet connection and try again.';
        }
        alert(msg);
        return;
      }

      const saveRes = await fetch(`${API_BASE}/people/${locationData.personId}/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          address: locationData.address,
          city: geoResult.result.city || '',
          state: geoResult.result.state || '',
          country: geoResult.result.country || '',
          postal_code: geoResult.result.postal_code || '',
          latitude: geoResult.result.lat,
          longitude: geoResult.result.lng,
          type: 'other',
          current: true,
          date_added: new Date().toISOString().split('T')[0],
          geocode_confidence: geoResult.result.confidence,
          geocode_provider: geoResult.result.provider || 'nominatim',
          geocoded_at: new Date().toISOString(),
        }),
      });

      if (saveRes.ok) {
        alert(`Location added successfully!\nAddress: ${locationData.address}\nCoordinates: ${geoResult.result.lat}, ${geoResult.result.lng}\nConfidence: ${geoResult.result.confidence}%`);
        onSuccess();
        onClose();
      } else {
        alert("Location geocoded but failed to save. Please try adding it manually from the person's profile.");
      }
    } catch (err) {
      console.error('Error adding location:', err);
      alert('Failed to add location');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-gray-600 shadow-lg rounded-lg p-6 w-96">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Add New Location</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Person</label>
            <select
              value={locationData.personId || ''}
              onChange={e => setLocationData(prev => ({ ...prev, personId: parseInt(e.target.value) || null }))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500"
            >
              <option value="">-- Select a person --</option>
              {allPeople.map(p => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name} {p.case_name ? `(${p.case_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Address</label>
            <input
              type="text"
              value={locationData.address}
              onChange={e => {
                setLocationData(prev => ({ ...prev, address: e.target.value }));
                getSuggestions(e.target.value);
              }}
              placeholder="Enter address to geocode..."
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 dark:text-gray-100 dark:placeholder-gray-600 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500 transition-all"
            />
            {suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-gray-600 shadow-lg rounded overflow-hidden">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setLocationData(prev => ({ ...prev, address: s.display_name })); setSuggestions([]); }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.display_name}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 flex justify-between">
                      <span>Confidence: {s.confidence}%</span>
                      <span>{s.lat.toFixed(4)}, {s.lng.toFixed(4)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => { onClose(); setSuggestions([]); }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!locationData.address.trim() || !locationData.personId}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddLocationModal;
