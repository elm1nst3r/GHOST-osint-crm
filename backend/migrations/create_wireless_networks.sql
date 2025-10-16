-- Wireless Networks Table for WiGLE Data
-- Created: October 2025
-- Purpose: Store wardriving/wireless network data from WiGLE exports

CREATE TABLE IF NOT EXISTS wireless_networks (
  id SERIAL PRIMARY KEY,

  -- Network identification
  ssid VARCHAR(255) NOT NULL,
  bssid VARCHAR(17) NOT NULL,  -- MAC address format: 00:11:22:33:44:55

  -- Location data
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,  -- Accuracy in meters

  -- Network details
  encryption VARCHAR(50),  -- WPA2, WPA3, WEP, Open, Unknown, etc.
  signal_strength INTEGER,  -- Signal in dBm (e.g., -65)
  frequency VARCHAR(20),  -- 2.4GHz, 5GHz, 6GHz
  channel INTEGER,
  network_type VARCHAR(20) DEFAULT 'WIFI',  -- WIFI, BLUETOOTH_CLASSIC, BLUETOOTH_LE, CELL

  -- Confidence/Quality
  confidence_level VARCHAR(20),  -- high, medium, low, zero

  -- Timestamps
  first_seen TIMESTAMP,
  last_seen TIMESTAMP,
  scan_date TIMESTAMP,

  -- Association with people
  person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
  association_note TEXT,  -- Why this network is associated with this person
  association_confidence VARCHAR(20),  -- confirmed, probable, possible, investigating

  -- Import metadata
  import_source VARCHAR(255),  -- Original filename or source
  import_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Additional metadata
  notes TEXT,
  tags TEXT[],

  -- Geofencing / Area
  area_name VARCHAR(255),  -- Custom area name (e.g., "Target's Neighborhood")

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Indexes for performance
  CONSTRAINT unique_network_location UNIQUE(bssid, latitude, longitude, scan_date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_wireless_ssid ON wireless_networks(ssid);
CREATE INDEX IF NOT EXISTS idx_wireless_bssid ON wireless_networks(bssid);
CREATE INDEX IF NOT EXISTS idx_wireless_location ON wireless_networks(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_wireless_person ON wireless_networks(person_id);
CREATE INDEX IF NOT EXISTS idx_wireless_scan_date ON wireless_networks(scan_date);
CREATE INDEX IF NOT EXISTS idx_wireless_network_type ON wireless_networks(network_type);
CREATE INDEX IF NOT EXISTS idx_wireless_encryption ON wireless_networks(encryption);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_wireless_networks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wireless_networks_updated_at
  BEFORE UPDATE ON wireless_networks
  FOR EACH ROW
  EXECUTE FUNCTION update_wireless_networks_updated_at();

-- Comments for documentation
COMMENT ON TABLE wireless_networks IS 'Stores wardriving/wireless network data from WiGLE and other sources';
COMMENT ON COLUMN wireless_networks.ssid IS 'Network name (SSID)';
COMMENT ON COLUMN wireless_networks.bssid IS 'MAC address of the access point';
COMMENT ON COLUMN wireless_networks.signal_strength IS 'Signal strength in dBm (negative values, closer to 0 is stronger)';
COMMENT ON COLUMN wireless_networks.person_id IS 'Associated person for investigative linking';
COMMENT ON COLUMN wireless_networks.association_confidence IS 'Confidence level of person association';
