// One-time (re-runnable) enrichment: for every building in the `buildings`
// table, find the nearby noise sources (major roads by class + rail lines)
// from OpenStreetMap, and pick a bounded set of road segments to poll live
// for traffic.
//
// Runs LOCALLY, not in the Worker (same rule as the GTFS pull — Overpass
// parsing would blow the cron CPU budget). Emits:
//   building_sources_schema.sql / building_sources_seed.sql
//   segments_schema.sql        / segments_seed.sql
//
// Usage:  node scripts/enrich-sources.mjs
// Needs:  scripts/buildings.json  (dump: wrangler d1 execute seenoise --remote
//         --json --command="SELECT osm_id,name,levels,lat,lon,state,city FROM buildings")
//
// Overpass mirrors are flaky (see CLAUDE.md) — this retries across mirrors
// with backoff and tiles the bbox to keep each response small.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const MIRRORS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const UA = "SeeNoise/1.0 (Klang Valley noise-mapping FYP; contact via github.com/DanIsWorkingNow)";

const ROAD_CLASSES = ["motorway", "trunk", "primary", "secondary"];
const RAIL_CLASSES = ["rail", "light_rail", "subway", "monorail"];
const MAX_SOURCE_M = 300; // ignore sources further than this
const SEGMENT_NEAR_M = 250; // a building "belongs to" a road within this
const MAX_POLLED_SEGMENTS = 20; // TomTom free tier + cron budget headroom

// Petalz Residences — the pilot building. Not in the OSM seed (its towers
// carry no building:levels tag), so it is injected here. 961998795 is one of
// its real OSM apartment-block ways.
const PILOT = {
  osm_id: 961998795,
  name: "Petalz Residences",
  levels: 34,
  lat: 3.0843233,
  lon: 101.6613956,
  state: "Kuala Lumpur",
  city: "Kuala Lumpur",
};

// ---------------------------------------------------------------------------

async function overpass(query) {
  let lastErr;
  for (let attempt = 0; attempt < MIRRORS.length * 2; attempt++) {
    const url = MIRRORS[attempt % MIRRORS.length];
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": UA },
        body: "data=" + encodeURIComponent(query),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
      const json = await res.json();
      return json.elements || [];
    } catch (err) {
      lastErr = err;
      const wait = 2000 * (attempt + 1);
      console.warn(`  overpass attempt ${attempt + 1} failed (${err.message}); retrying in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

function bbox(buildings) {
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  for (const b of buildings) {
    minLat = Math.min(minLat, b.lat); maxLat = Math.max(maxLat, b.lat);
    minLon = Math.min(minLon, b.lon); maxLon = Math.max(maxLon, b.lon);
  }
  const pad = 0.01;
  return [minLat - pad, minLon - pad, maxLat + pad, maxLon + pad];
}

// tile the bbox so each Overpass response stays small
function tiles([s, w, n, e], nx = 3, ny = 3) {
  const out = [];
  const dx = (e - w) / nx, dy = (n - s) / ny;
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++)
      out.push([s + j * dy, w + i * dx, s + (j + 1) * dy, w + (i + 1) * dx]);
  return out;
}

async function fetchWays(buildings) {
  const cache = join(HERE, "ways.cache.json");
  try {
    const cached = JSON.parse(readFileSync(cache, "utf8"));
    console.log(`Using cached ${cached.length} ways (delete scripts/ways.cache.json to refetch).`);
    return cached;
  } catch { /* no cache, fetch below */ }

  const box = bbox(buildings);
  const ts = tiles(box);
  console.log(`Fetching roads + rail over ${ts.length} tiles...`);
  const ways = new Map(); // id -> { id, kind, class, name, ref, geom: [[lat,lon],...] }

  for (let i = 0; i < ts.length; i++) {
    const [s, w, n, e] = ts[i];
    const q = `[out:json][timeout:120];
(
  way["highway"~"^(motorway|trunk|primary|secondary)$"](${s},${w},${n},${e});
  way["railway"~"^(rail|light_rail|subway|monorail)$"](${s},${w},${n},${e});
);
out geom;`;
    const els = await overpass(q);
    for (const el of els) {
      if (ways.has(el.id) || !el.geometry) continue;
      const t = el.tags || {};
      const isRail = "railway" in t;
      ways.set(el.id, {
        id: el.id,
        kind: isRail ? "rail" : "road",
        class: isRail ? t.railway : t.highway,
        name: t.name || t["name:en"] || null,
        ref: t.ref || null,
        geom: el.geometry.map((g) => [g.lat, g.lon]),
      });
    }
    console.log(`  tile ${i + 1}/${ts.length}: ${els.length} ways (total unique ${ways.size})`);
  }
  const out = [...ways.values()];
  writeFileSync(join(HERE, "ways.cache.json"), JSON.stringify(out));
  return out;
}

// ---- geometry: metres, point-to-polyline -------------------------------

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

// local equirectangular projection around a reference lat, metres
function projector(refLat) {
  const kx = (Math.cos(rad(refLat)) * Math.PI * R) / 180;
  const ky = (Math.PI * R) / 180;
  return (lat, lon) => [lon * kx, lat * ky];
}

function distPointToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return { d: Math.hypot(px - cx, py - cy), t, cx, cy };
}

// min distance (m) from a building to a way's polyline, plus the closest
// point on the way (lat/lon) — used later to place the poll marker.
function nearestOnWay(b, way, proj) {
  const [px, py] = proj(b.lat, b.lon);
  let best = { d: Infinity, lat: null, lon: null };
  for (let i = 0; i + 1 < way.geom.length; i++) {
    const [ax, ay] = proj(way.geom[i][0], way.geom[i][1]);
    const [bx, by] = proj(way.geom[i + 1][0], way.geom[i + 1][1]);
    const r = distPointToSeg(px, py, ax, ay, bx, by);
    if (r.d < best.d) {
      const lat0 = way.geom[i][0] + r.t * (way.geom[i + 1][0] - way.geom[i][0]);
      const lon0 = way.geom[i][1] + r.t * (way.geom[i + 1][1] - way.geom[i][1]);
      best = { d: r.d, lat: lat0, lon: lon0 };
    }
  }
  return best;
}

// bounding box of a way, for cheap prefiltering
function wayBox(way) {
  let s = 90, w = 180, n = -90, e = -180;
  for (const [la, lo] of way.geom) {
    s = Math.min(s, la); n = Math.max(n, la);
    w = Math.min(w, lo); e = Math.max(e, lo);
  }
  return [s, w, n, e];
}

// ---------------------------------------------------------------------------

async function main() {
  const buildings = JSON.parse(readFileSync(join(HERE, "buildings.json"), "utf8"));
  if (!buildings.some((b) => b.osm_id === PILOT.osm_id)) buildings.push(PILOT);
  console.log(`${buildings.length} buildings (incl. pilot).`);

  const ways = await fetchWays(buildings);
  console.log(`${ways.length} unique ways.`);

  const boxes = ways.map(wayBox);
  const degPad = MAX_SOURCE_M / 111000 + 0.001;

  // per-building: nearest source per (kind,class); also accumulate, per way,
  // the closest approach to any building (to place the poll marker later)
  const perBuilding = new Map(); // osm_id -> [{kind,class,name,ref,distance_m,wayId}]
  const wayClosest = new Map(); // wayId -> {d, lat, lon, count}

  let done = 0;
  for (const b of buildings) {
    const proj = projector(b.lat);
    const bestByKey = new Map();
    for (let wi = 0; wi < ways.length; wi++) {
      const [s, w, n, e] = boxes[wi];
      if (b.lat < s - degPad || b.lat > n + degPad || b.lon < w - degPad || b.lon > e + degPad) continue;
      const way = ways[wi];
      const near = nearestOnWay(b, way, proj);
      if (near.d > MAX_SOURCE_M) continue;

      const key = `${way.kind}:${way.class}`;
      const prev = bestByKey.get(key);
      if (!prev || near.d < prev.distance_m) {
        bestByKey.set(key, {
          kind: way.kind, class: way.class, name: way.name, ref: way.ref,
          distance_m: Math.round(near.d), wayId: way.id,
        });
      }
      if (near.d <= SEGMENT_NEAR_M && way.kind === "road") {
        const wc = wayClosest.get(way.id) || { d: Infinity, lat: near.lat, lon: near.lon, count: 0 };
        wc.count++;
        if (near.d < wc.d) { wc.d = near.d; wc.lat = near.lat; wc.lon = near.lon; }
        wayClosest.set(way.id, wc);
      }
    }
    perBuilding.set(b.osm_id, [...bestByKey.values()]);
    if (++done % 200 === 0) console.log(`  ${done}/${buildings.length} buildings processed`);
  }

  // --- choose polled segments: busiest roads by nearby-building count ------
  const wayById = new Map(ways.map((w) => [w.id, w]));
  const ranked = [...wayClosest.entries()]
    .map(([id, wc]) => ({ id, ...wc, way: wayById.get(id) }))
    .filter((x) => x.way && x.way.name) // need a name to dedupe / label
    .sort((a, b) => b.count - a.count);

  // dedupe by road name+ref (OSM splits one road into many ways)
  const segByName = new Map();
  for (const r of ranked) {
    const label = `${r.way.name}${r.way.ref ? ` (${r.way.ref})` : ""}`;
    if (!segByName.has(label)) {
      segByName.set(label, {
        name: r.way.name, ref: r.way.ref, road_class: r.way.class,
        lat: r.lat, lon: r.lon, building_count: r.count,
      });
    } else {
      segByName.get(label).building_count += r.count;
    }
  }
  let segments = [...segByName.values()]
    .sort((a, b) => b.building_count - a.building_count)
    .slice(0, MAX_POLLED_SEGMENTS);

  // keep the two original pilot segments regardless of ranking
  const pilotSegs = [
    { name: "NPE (New Pantai Expressway)", ref: "E10", road_class: "motorway", lat: 3.0833212, lon: 101.6611416, building_count: 0 },
    { name: "Jalan Klang Lama", ref: "B14", road_class: "primary", lat: 3.0835053, lon: 101.6614847, building_count: 0 },
  ];
  for (const ps of pilotSegs) {
    if (!segments.some((s) => s.name === ps.name)) segments.push(ps);
  }
  segments = segments.slice(0, MAX_POLLED_SEGMENTS + pilotSegs.length);

  // map building_sources.road entries to a segment id — match on name, or on
  // ref when both sides have one (OSM often names the NPE "Lebuhraya Baru
  // Pantai" while the segment row keeps the colloquial name).
  const segIndexByName = new Map();
  const segIndexByRef = new Map();
  segments.forEach((s, i) => {
    segIndexByName.set(s.name, i + 1);
    if (s.ref) segIndexByRef.set(s.ref, i + 1);
  });
  const segIdFor = (src) =>
    segIndexByName.get(src.name) ?? (src.ref ? segIndexByRef.get(src.ref) : undefined) ?? null;

  // --- emit SQL ----------------------------------------------------------
  const esc = (v) => (v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);

  writeFileSync(join(ROOT, "sources_schema.sql"), `-- Noise sources per building + the road segments polled live for traffic.
-- Generated by scripts/enrich-sources.mjs from OpenStreetMap. Re-run that to refresh.

CREATE TABLE IF NOT EXISTS segments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL UNIQUE,
  ref            TEXT,
  road_class     TEXT NOT NULL,
  lat            REAL NOT NULL,
  lon            REAL NOT NULL,
  poll           INTEGER NOT NULL DEFAULT 1,   -- cron polls WHERE poll = 1
  building_count INTEGER NOT NULL DEFAULT 0,   -- buildings within ${SEGMENT_NEAR_M} m
  last_polled    TEXT                          -- ISO 8601, updated by the collector
);

CREATE TABLE IF NOT EXISTS building_sources (
  osm_id      INTEGER NOT NULL,   -- buildings.osm_id
  kind        TEXT NOT NULL,      -- 'road' | 'rail'
  class       TEXT NOT NULL,      -- motorway|trunk|primary|secondary | rail|light_rail|subway|monorail
  name        TEXT,
  ref         TEXT,
  distance_m  REAL NOT NULL,      -- nearest approach, metres
  segment_id  INTEGER,           -- segments.id when this source is polled live, else NULL
  PRIMARY KEY (osm_id, kind, class)
);
CREATE INDEX IF NOT EXISTS idx_building_sources_osm ON building_sources(osm_id);

-- readings gains a segment_id (old rows stay NULL; joined by name as before)
-- Applied separately in sources_seed.sql via ALTER TABLE (ignored if present).
`);

  const segLines = segments.map((s) =>
    `(${esc(s.name)}, ${esc(s.ref)}, ${esc(s.road_class)}, ${s.lat.toFixed(7)}, ${s.lon.toFixed(7)}, 1, ${s.building_count})`
  );

  let seed = `-- Generated by scripts/enrich-sources.mjs. Do not hand-edit.

-- add segment_id to readings if the column isn't there yet
-- (D1 has no "ADD COLUMN IF NOT EXISTS"; this errors harmlessly on re-run)
ALTER TABLE readings ADD COLUMN segment_id INTEGER;

DELETE FROM segments;
DELETE FROM sqlite_sequence WHERE name = 'segments';
INSERT INTO segments (name, ref, road_class, lat, lon, poll, building_count) VALUES
${segLines.join(",\n")};

-- ensure the pilot building exists (skipped by the OSM levels filter)
INSERT OR IGNORE INTO buildings (osm_id, name, levels, lat, lon, state, city) VALUES
(${PILOT.osm_id}, ${esc(PILOT.name)}, ${PILOT.levels}, ${PILOT.lat}, ${PILOT.lon}, ${esc(PILOT.state)}, ${esc(PILOT.city)});

DELETE FROM building_sources;
`;

  const rows = [];
  for (const [osmId, srcs] of perBuilding) {
    for (const s of srcs) {
      const segId = s.kind === "road" ? segIdFor(s) : null;
      rows.push(`(${osmId}, ${esc(s.kind)}, ${esc(s.class)}, ${esc(s.name)}, ${esc(s.ref)}, ${s.distance_m}, ${segId ?? "NULL"})`);
    }
  }
  // chunk inserts (D1 has a statement size limit)
  for (let i = 0; i < rows.length; i += 400) {
    seed += `INSERT INTO building_sources (osm_id, kind, class, name, ref, distance_m, segment_id) VALUES\n`;
    seed += rows.slice(i, i + 400).join(",\n") + ";\n";
  }

  writeFileSync(join(ROOT, "sources_seed.sql"), seed);

  const withSources = [...perBuilding.values()].filter((s) => s.length).length;
  console.log(`\nDone.`);
  console.log(`  building_sources rows: ${rows.length}`);
  console.log(`  buildings with >=1 source: ${withSources}/${buildings.length}`);
  console.log(`  polled segments: ${segments.length}`);
  console.log(`  wrote sources_schema.sql, sources_seed.sql`);
}

main().catch((e) => { console.error(e); process.exit(1); });
