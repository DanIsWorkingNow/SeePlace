-- High-rise building seed data, pulled from OpenStreetMap for Klang Valley
-- (buildings tagged building=apartments/residential with building:levels 10-99).
-- 1,118 rows as of the Sept 2026 pull -- see buildings_seed.sql.

CREATE TABLE IF NOT EXISTS buildings (
  osm_id INTEGER PRIMARY KEY,        -- OpenStreetMap way id, doubles as a stable unique key
  name TEXT,                         -- NULL for ~63% of rows -- OSM has no name tag for many blocks/towers
  levels INTEGER,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  state TEXT NOT NULL,               -- assigned via point-in-polygon against admin_level=4 boundaries
  city TEXT NOT NULL                 -- assigned via point-in-polygon against admin_level=7 (fallback 6) boundaries
);

-- Lets "buildings within X of this point" queries use a fast bounding-box
-- WHERE clause instead of scanning every row.
CREATE INDEX IF NOT EXISTS idx_buildings_lat ON buildings(lat);
CREATE INDEX IF NOT EXISTS idx_buildings_lon ON buildings(lon);

-- Lets the app's building search-by-name (autocomplete) hit an index
-- instead of a full table scan.
CREATE INDEX IF NOT EXISTS idx_buildings_name ON buildings(name);

-- Powers the state -> city filter UI. Composite index means "give me
-- every city in Selangor" and "give me every building in Petaling Jaya"
-- are both index lookups, not table scans.
CREATE INDEX IF NOT EXISTS idx_buildings_state_city ON buildings(state, city);
