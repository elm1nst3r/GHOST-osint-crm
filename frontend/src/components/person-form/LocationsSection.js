import React, { useState } from 'react';
import { MapPin, Plus, Trash2 } from 'lucide-react';

const EMPTY_LOCATION = { type: 'primary_residence', address: '', city: '', state: '', country: '', postal_code: '', notes: '' };

const LocationsSection = ({ locations, locationTypes, onChange }) => {
  const [newLocation, setNewLocation] = useState(EMPTY_LOCATION);

  const add = () => {
    if (!newLocation.address.trim()) return;
    onChange([...locations, { ...newLocation, id: Date.now() }]);
    setNewLocation(EMPTY_LOCATION);
  };

  const remove = (i) => onChange(locations.filter((_, idx) => idx !== i));

  const field = (key, placeholder, colClass = 'w-full') => (
    <input
      type="text"
      value={newLocation[key]}
      onChange={e => setNewLocation({ ...newLocation, [key]: e.target.value })}
      placeholder={placeholder}
      className={`${colClass} px-3 py-2 border dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100`}
    />
  );

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        <MapPin className="w-4 h-4 inline mr-1" />Locations
      </label>

      <div className="space-y-3 mb-3 bg-gray-50 dark:bg-slate-900 p-4 rounded-lg">
        <div className="grid grid-cols-2 gap-3">
          <select
            value={newLocation.type}
            onChange={e => setNewLocation({ ...newLocation, type: e.target.value })}
            className="w-full px-3 py-2 border dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-gray-100"
          >
            {locationTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {field('address', 'Street Address')}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {field('city', 'City')}
          {field('state', 'State/Province')}
          {field('country', 'Country')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field('postal_code', 'Postal Code')}
          {field('notes', 'Notes (optional)')}
        </div>
        <button type="button" onClick={add} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center">
          <Plus className="w-4 h-4 mr-2" />Add Location
        </button>
      </div>

      <div className="space-y-2">
        {locations.map((loc, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border rounded-lg">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-medium text-sm px-2 py-1 bg-blue-100 text-blue-800 rounded">
                  {locationTypes.find(t => t.value === loc.type)?.label || loc.type}
                </span>
                <span className="font-medium">{loc.address}</span>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {[loc.city, loc.state, loc.country, loc.postal_code].filter(Boolean).join(', ')}
              </div>
              {loc.notes && <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">{loc.notes}</p>}
            </div>
            <button type="button" onClick={() => remove(i)} className="text-red-600 hover:text-red-700">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LocationsSection;
