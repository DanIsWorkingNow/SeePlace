-- Main time-series table. One row per (timestamp, road segment).
CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,                 -- ISO 8601 UTC timestamp
  segment TEXT NOT NULL,            -- e.g. "NPE" or "Jalan Klang Lama"
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  frc TEXT,                         -- TomTom functional road class
  current_speed REAL,
  free_flow_speed REAL,
  speed_ratio REAL,                 -- current_speed / free_flow_speed
  confidence REAL,
  road_closure INTEGER,             -- 0 or 1
  train_passbys_this_hour INTEGER   -- looked up from train_hourly_pattern
);

CREATE INDEX IF NOT EXISTS idx_readings_ts ON readings(ts);
CREATE INDEX IF NOT EXISTS idx_readings_segment ON readings(segment);

-- Static lookup: KTM pass-by count per hour (Malaysia local time, 0-23).
-- Derived from the KTMB GTFS static feed (data.gov.my) for stops
-- PETALING and JALAN TEMPLER, the two nearest to Petalz Residences.
-- Refresh this occasionally by re-running the GTFS pull -- it does NOT
-- need to run inside the Worker's cron job.
CREATE TABLE IF NOT EXISTS train_hourly_pattern (
  hour INTEGER PRIMARY KEY,
  passbys INTEGER NOT NULL
);
