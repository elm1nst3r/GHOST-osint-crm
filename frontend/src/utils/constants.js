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
  
  // OSINT data types
  export const OSINT_DATA_TYPES = [
    { value: 'Email', label: 'Email' },
    { value: 'Phone', label: 'Phone' },
    { value: 'Social Media', label: 'Social Media' },
    { value: 'Website', label: 'Website' },
    { value: 'Location', label: 'Location' },
    { value: 'Username', label: 'Username' },
    { value: 'Other', label: 'Other' },
  ];
  
  // Connection types
  export const CONNECTION_TYPES = [
    { value: 'associate', label: 'Associate' },
    { value: 'family', label: 'Family' },
    { value: 'employer', label: 'Employer/Employee' },
    { value: 'suspect', label: 'Suspect Connection' },
    { value: 'witness', label: 'Witness' },
    { value: 'victim', label: 'Victim' },
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
  
  // Default app settings
  export const DEFAULT_APP_SETTINGS = {
    appName: 'OSINT Investigation CRM',
    appLogo: null,
  };