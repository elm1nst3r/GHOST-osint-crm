// File: backend/config/seedDefaults.js
// Default model_options, ensured on every server boot (moved out of the old
// initializeDatabase() when schema moved to Knex migrations, issue #48).
// Runs every start — unlike a migration — so releases can add new default
// options and existing installs pick them up. ON CONFLICT keeps it idempotent
// and never overwrites user edits.

const defaultOptions = [
  // Categories
  { model_type: 'person_category', option_value: 'Person of Interest', option_label: 'Person of Interest', display_order: 1 },
  { model_type: 'person_category', option_value: 'Client', option_label: 'Client', display_order: 2 },
  { model_type: 'person_category', option_value: 'Witness', option_label: 'Witness', display_order: 3 },
  { model_type: 'person_category', option_value: 'Victim', option_label: 'Victim', display_order: 4 },
  { model_type: 'person_category', option_value: 'Suspect', option_label: 'Suspect', display_order: 5 },
  { model_type: 'person_category', option_value: 'Related to Person of Interest', option_label: 'Related to Person of Interest', display_order: 6 },
  { model_type: 'person_category', option_value: 'Other', option_label: 'Other', display_order: 7 },

  // Statuses
  { model_type: 'person_status', option_value: 'Open', option_label: 'Open', display_order: 1 },
  { model_type: 'person_status', option_value: 'Being Investigated', option_label: 'Being Investigated', display_order: 2 },
  { model_type: 'person_status', option_value: 'Closed', option_label: 'Closed', display_order: 3 },
  { model_type: 'person_status', option_value: 'On Hold', option_label: 'On Hold', display_order: 4 },

  // CRM Statuses
  { model_type: 'crm_status', option_value: 'new_lead', option_label: 'New Lead', display_order: 1 },
  { model_type: 'crm_status', option_value: 'attempted_engage', option_label: 'Attempted to Engage', display_order: 2 },
  { model_type: 'crm_status', option_value: 'engaged', option_label: 'Engaged', display_order: 3 },
  { model_type: 'crm_status', option_value: 'qualified', option_label: 'Qualified', display_order: 4 },
  { model_type: 'crm_status', option_value: 'follow_up', option_label: 'Follow Up', display_order: 5 },
  { model_type: 'crm_status', option_value: 'archived', option_label: 'Archived', display_order: 6 },
  { model_type: 'crm_status', option_value: 'active', option_label: 'Active', display_order: 7 },
  { model_type: 'crm_status', option_value: 'awaiting_response', option_label: 'Awaiting Response', display_order: 8 },

  // Task Statuses
  { model_type: 'task_status', option_value: 'open', option_label: 'Open', display_order: 1 },
  { model_type: 'task_status', option_value: 'in_progress', option_label: 'In Progress', display_order: 2 },
  { model_type: 'task_status', option_value: 'on_hold', option_label: 'On Hold', display_order: 3 },
  { model_type: 'task_status', option_value: 'attention', option_label: 'Attention / Issue', display_order: 4 },
  { model_type: 'task_status', option_value: 'done', option_label: 'Done', display_order: 5 },
  { model_type: 'task_status', option_value: 'cancelled', option_label: 'Cancelled', display_order: 6 },

  // Connection Types
  { model_type: 'connection_type', option_value: 'family', option_label: 'Family', display_order: 1 },
  { model_type: 'connection_type', option_value: 'friend', option_label: 'Friend', display_order: 2 },
  { model_type: 'connection_type', option_value: 'enemy', option_label: 'Enemy', display_order: 3 },
  { model_type: 'connection_type', option_value: 'associate', option_label: 'Associate', display_order: 4 },
  { model_type: 'connection_type', option_value: 'employer', option_label: 'Employer/Employee', display_order: 5 },
  { model_type: 'connection_type', option_value: 'suspect', option_label: 'Suspect Connection', display_order: 6 },
  { model_type: 'connection_type', option_value: 'witness', option_label: 'Witness', display_order: 7 },
  { model_type: 'connection_type', option_value: 'victim', option_label: 'Victim', display_order: 8 },
  { model_type: 'connection_type', option_value: 'other', option_label: 'Other', display_order: 9 },

  // Location Types
  { model_type: 'location_type', option_value: 'primary_residence', option_label: 'Primary Residence', display_order: 1 },
  { model_type: 'location_type', option_value: 'holiday_home', option_label: 'Holiday Home', display_order: 2 },
  { model_type: 'location_type', option_value: 'work', option_label: 'Work', display_order: 3 },
  { model_type: 'location_type', option_value: 'favorite_hotel', option_label: 'Favorite Hotel', display_order: 4 },
  { model_type: 'location_type', option_value: 'yacht_location', option_label: 'Yacht Location', display_order: 5 },
  { model_type: 'location_type', option_value: 'other', option_label: 'Other', display_order: 6 },

  // Transaction types
  { model_type: 'transaction_type', option_value: 'gift',       option_label: 'Gift',                  display_order: 1 },
  { model_type: 'transaction_type', option_value: 'donation',   option_label: 'Donation',              display_order: 2 },
  { model_type: 'transaction_type', option_value: 'benefit',    option_label: 'Benefit / Hospitality', display_order: 3 },
  { model_type: 'transaction_type', option_value: 'sale',       option_label: 'Sale',                  display_order: 4 },
  { model_type: 'transaction_type', option_value: 'purchase',   option_label: 'Purchase',              display_order: 5 },
  { model_type: 'transaction_type', option_value: 'transfer',   option_label: 'Transfer',              display_order: 6 },
  { model_type: 'transaction_type', option_value: 'assignment', option_label: 'Assignment',            display_order: 7 },
  { model_type: 'transaction_type', option_value: 'return',     option_label: 'Returned',              display_order: 8 },
  { model_type: 'transaction_type', option_value: 'loan',       option_label: 'Loan / Borrowed',       display_order: 9 },
  { model_type: 'transaction_type', option_value: 'acquisition',option_label: 'Acquisition',           display_order: 10 },
  { model_type: 'transaction_type', option_value: 'lost',       option_label: 'Lost',                  display_order: 11 },
  { model_type: 'transaction_type', option_value: 'seized',     option_label: 'Seized',                display_order: 12 },
  { model_type: 'transaction_type', option_value: 'visit',      option_label: 'Visit / Attendance',    display_order: 13 },
  { model_type: 'transaction_type', option_value: 'other',      option_label: 'Other',                 display_order: 14 },

  // Transaction item categories
  { model_type: 'transaction_item_category', option_value: 'cash_donation',    option_label: 'Cash / Donation',    display_order: 1 },
  { model_type: 'transaction_item_category', option_value: 'hospitality',      option_label: 'Hospitality / Meal', display_order: 2 },
  { model_type: 'transaction_item_category', option_value: 'tickets_event',    option_label: 'Tickets / Event',    display_order: 3 },
  { model_type: 'transaction_item_category', option_value: 'travel',           option_label: 'Travel',             display_order: 4 },
  { model_type: 'transaction_item_category', option_value: 'real_estate',      option_label: 'Real Estate',        display_order: 5 },
  { model_type: 'transaction_item_category', option_value: 'business_interest',option_label: 'Business Interest',  display_order: 6 },
  { model_type: 'transaction_item_category', option_value: 'physical_good',    option_label: 'Physical Good',      display_order: 7 },
  { model_type: 'transaction_item_category', option_value: 'other',            option_label: 'Other',              display_order: 8 },

  // Asset categories
  { model_type: 'asset_category', option_value: 'watch',           option_label: 'Watch',           display_order: 1 },
  { model_type: 'asset_category', option_value: 'jewellery',       option_label: 'Jewellery',       display_order: 2 },
  { model_type: 'asset_category', option_value: 'electronics',     option_label: 'Electronics',     display_order: 3 },
  { model_type: 'asset_category', option_value: 'laptop',          option_label: 'Laptop / Device', display_order: 4 },
  { model_type: 'asset_category', option_value: 'vehicle',         option_label: 'Vehicle',         display_order: 5 },
  { model_type: 'asset_category', option_value: 'tracking_device', option_label: 'Tracking Device', display_order: 6 },
  { model_type: 'asset_category', option_value: 'document',        option_label: 'Document',        display_order: 7 },
  { model_type: 'asset_category', option_value: 'other',           option_label: 'Other',           display_order: 8 },

  // Asset statuses
  { model_type: 'asset_status', option_value: 'active',    option_label: 'Active',    display_order: 1 },
  { model_type: 'asset_status', option_value: 'lost',      option_label: 'Lost',      display_order: 2 },
  { model_type: 'asset_status', option_value: 'destroyed', option_label: 'Destroyed', display_order: 3 },
  { model_type: 'asset_status', option_value: 'seized',    option_label: 'Seized',    display_order: 4 },
  { model_type: 'asset_status', option_value: 'disposed',  option_label: 'Disposed',  display_order: 5 },

  // Property types
  { model_type: 'property_type', option_value: 'parcel',          option_label: 'Parcel / Lot',    display_order: 1 },
  { model_type: 'property_type', option_value: 'residential',     option_label: 'Residential',     display_order: 2 },
  { model_type: 'property_type', option_value: 'rental',          option_label: 'Rental Property', display_order: 3 },
  { model_type: 'property_type', option_value: 'commercial',      option_label: 'Commercial',      display_order: 4 },
  { model_type: 'property_type', option_value: 'land',            option_label: 'Land',            display_order: 5 },
  { model_type: 'property_type', option_value: 'development_site', option_label: 'Development Site',display_order: 6 },
  { model_type: 'property_type', option_value: 'other',           option_label: 'Other',           display_order: 7 }
];

async function seedDefaults(pool) {
  for (const option of defaultOptions) {
    await pool.query(`
      INSERT INTO model_options (model_type, option_value, option_label, display_order)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (model_type, option_value) DO NOTHING
    `, [option.model_type, option.option_value, option.option_label, option.display_order]);
  }
  console.log('Ensured default model options exist.');
}

module.exports = { seedDefaults, defaultOptions };
