import L from 'leaflet';

export const locationColors = {
  primary_residence: '#10b981',
  holiday_home:      '#3b82f6',
  work:              '#f59e0b',
  family_residence:  '#8b5cf6',
  favorite_hotel:    '#ec4899',
  yacht_location:    '#06b6d4',
  other:             '#6b7280',
};

export const buildIconCache = () => {
  const cache = {};

  Object.entries(locationColors).forEach(([type, color]) => {
    cache[`${type}-full`] = L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color:${color};width:24px;height:24px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    cache[`${type}-partial`] = L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color:${color};width:20px;height:20px;border-radius:50%;border:2px dashed white;box-shadow:0 2px 4px rgba(0,0,0,0.3);opacity:0.7"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  });

  cache['wifi'] = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color:#3b82f6;width:28px;height:28px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 13a10 10 0 0 1 14 0"></path>
        <path d="M8.5 16.5a5 5 0 0 1 7 0"></path>
        <path d="M2 8.82a15 15 0 0 1 20 0"></path>
        <line x1="12" y1="20" x2="12.01" y2="20"></line>
      </svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  return cache;
};
