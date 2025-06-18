// File: frontend/src/utils/constants.js

// Person categories
export const PERSON_CATEGORIES = [
    { value: 'Person of Interest', label: 'Person of Interest' },
    { value: 'Client', label: 'Client' },
    { value: 'Witness', label: 'Witness' },
    { value: 'Victim', label: 'Victim' },
    { value: 'Suspect', label: 'Suspect' },
    { value: 'Other', label: 'Other' },
  ];
  
  // Person statuses
  export const PERSON_STATUSES = [
    { value: 'Open', label: 'Open', color: 'green' },
    { value: 'Being Investigated', label: 'Being Investigated', color: 'yellow' },
    { value: 'Closed', label: 'Closed', color: 'gray' },
    { value: 'On Hold', label: 'On Hold', color: 'blue' },
  ];
  
  // CRM Statuses - DYNAMIC (will be loaded from database)
  export let CRM_STATUSES = [
    { value: 'new_lead', label: 'New Lead' },
    { value: 'attempted_engage', label: 'Attempted to Engage' },
    { value: 'engaged', label: 'Engaged' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'follow_up', label: 'Follow Up' },
    { value: 'archived', label: 'Archived' },
    { value: 'active', label: 'Active' },
    { value: 'awaiting_response', label: 'Awaiting Response' },
  ];
  
  // OSINT data types - DYNAMIC (will be loaded from database)
  export let OSINT_DATA_TYPES = [
    { value: 'Email', label: 'Email' },
    { value: 'Phone', label: 'Phone' },
    { value: 'Social Media', label: 'Social Media' },
    { value: 'Website', label: 'Website' },
    { value: 'Username', label: 'Username' },
    { value: 'IP Address', label: 'IP Address' },
    { value: 'Vehicle', label: 'Vehicle' },
    { value: 'Financial', label: 'Financial' },
    { value: 'Document ID', label: 'Document ID' },
    { value: 'Other', label: 'Other' },
  ];
  
  // Connection types - DYNAMIC (will be loaded from database)
  export let CONNECTION_TYPES = [
    { value: 'associate', label: 'Associate' },
    { value: 'family', label: 'Family' },
    { value: 'friend', label: 'Friend' },
    { value: 'enemy', label: 'Enemy' },
    { value: 'employer', label: 'Employer/Employee' },
    { value: 'suspect', label: 'Suspect Connection' },
    { value: 'witness', label: 'Witness' },
    { value: 'victim', label: 'Victim' },
    { value: 'other', label: 'Other' },
  ];
  
  // Location types
  export const LOCATION_TYPES = [
    { value: 'primary_residence', label: 'Primary Residence' },
    { value: 'holiday_home', label: 'Holiday Home' },
    { value: 'work', label: 'Work' },
    { value: 'family_residence', label: 'Family Residence' },
    { value: 'favorite_hotel', label: 'Favorite Hotel' },
    { value: 'yacht_location', label: 'Yacht Location' },
    { value: 'other', label: 'Other' },
  ];
  
  // Tool categories
  export const TOOL_CATEGORIES = [
    { value: 'Search Engines', label: 'Search Engines' },
    { value: 'Social Media', label: 'Social Media' },
    { value: 'People Search', label: 'People Search' },
    { value: 'Data Analysis', label: 'Data Analysis' },
    { value: 'Geolocation', label: 'Geolocation' },
    { value: 'Documentation', label: 'Documentation' },
    { value: 'Other', label: 'Other' },
  ];
  
  // Tool statuses
  export const TOOL_STATUSES = [
    { value: 'Active', label: 'Active', color: 'green' },
    { value: 'Testing', label: 'Testing', color: 'yellow' },
    { value: 'Deprecated', label: 'Deprecated', color: 'red' },
    { value: 'Offline', label: 'Offline', color: 'gray' },
  ];
  
  // Custom field types
  export const CUSTOM_FIELD_TYPES = [
    { value: 'text', label: 'Text' },
    { value: 'textarea', label: 'Textarea' },
    { value: 'select', label: 'Dropdown' },
    { value: 'date', label: 'Date' },
  ];

// Travel purposes
export const TRAVEL_PURPOSES = [
  { value: 'business', label: 'Business' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'family_visit', label: 'Family Visit' },
  { value: 'medical', label: 'Medical' },
  { value: 'education', label: 'Education' },
  { value: 'conference', label: 'Conference' },
  { value: 'relocation', label: 'Relocation' },
  { value: 'transit', label: 'Transit' },
  { value: 'unknown', label: 'Unknown' },
  { value: 'other', label: 'Other' },
];

// Transportation modes
export const TRANSPORTATION_MODES = [
  { value: 'airplane', label: 'Airplane' },
  { value: 'train', label: 'Train' },
  { value: 'car', label: 'Car' },
  { value: 'bus', label: 'Bus' },
  { value: 'ship', label: 'Ship/Cruise' },
  { value: 'private_jet', label: 'Private Jet' },
  { value: 'helicopter', label: 'Helicopter' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: 'Unknown' },
];
  
  // Default app settings
  export const DEFAULT_APP_SETTINGS = {
    appName: 'OSINT Investigation CRM',
    appLogo: null,
  };
  
  // Function to update dynamic constants from database
  export const updateDynamicConstants = (modelOptions) => {
    const connectionOptions = modelOptions
      .filter(opt => opt.model_type === 'connection_type' && opt.is_active)
      .sort((a, b) => a.display_order - b.display_order)
      .map(opt => ({ value: opt.option_value, label: opt.option_label }));
    
    if (connectionOptions.length > 0) {
      CONNECTION_TYPES = connectionOptions;
    }
  
    const crmStatuses = modelOptions
      .filter(opt => opt.model_type === 'crm_status' && opt.is_active)
      .sort((a, b) => a.display_order - b.display_order)
      .map(opt => ({ value: opt.option_value, label: opt.option_label }));
    
    if (crmStatuses.length > 0) {
      CRM_STATUSES = crmStatuses;
    }

    const osintDataTypes = modelOptions
      .filter(opt => opt.model_type === 'osint_data_type' && opt.is_active)
      .sort((a, b) => a.display_order - b.display_order)
      .map(opt => ({ value: opt.option_value, label: opt.option_label }));
    
    if (osintDataTypes.length > 0) {
      OSINT_DATA_TYPES = osintDataTypes;
    }
  };