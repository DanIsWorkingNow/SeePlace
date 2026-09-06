// SeeNoise Worker — data collector + read-only API + static frontend host
//
// Three responsibilities, one deployment:
//   1. scheduled()  — every 15 min (see wrangler.toml), pulls TomTom Traffic
//      Flow for the road segments near Petalz Residences, looks up the KTM
//      train pass-by count for the hour, logs one row per segment to D1.
//   2. fetch() /api/* — read-only JSON over the same D1 database, for the
//      React frontend in web/.
//   3. fetch() everything else — serves the built React SPA via the [assets]
//      binding (env.ASSETS), with index.html fallback for client-side routes.
//
// Deliberately lightweight collector: no GTFS parsing happens in scheduled()
// (that would blow past the Workers Free plan's 10ms CPU budget for a cron
// invocation). train_hourly_pattern is a small static lookup, refreshed
// separately and rarely — see seed.sql / README.md. The /api/* handlers run
// on the normal request path, which is NOT on the cron CPU budget, but they
// are still all single-statement SELECTs — keep them that way.

const SEGMENTS = [
  { name: "NPE (New Pantai Expressway)", lat: 3.0833212, lon: 101.6611416 },
  { name: "Jalan Klang Lama", lat: 3.0835053, lon: 101.6614847 },
];

// The pilot building. Petalz Residences is NOT in the OSM `buildings` table
// (it has no `building:levels` tag, so the seed query skipped it), so it is
// described here explicitly. Distances are the measured source distances from
// CLAUDE.md. This is the only location with real logged `readings` data.
const PILOT = {
  id: "petalz",
  name: "Petalz Residences",
  address: "Jalan Klang Lama, Kuala Lumpur",
  lat: 3.0843233,
  lon: 101.6613956,
  levels: 34,
  sources: [
    { kind: "rail", name: "KTM Port Klang line", distance_m: 89, segment: null },
    { kind: "road", name: "Jalan Klang Lama (B14)", distance_m: 91, segment: "Jalan Klang Lama" },
    { kind: "motorway", name: "New Pantai Expressway (E10)", distance_m: 95, segment: "NPE (New Pantai Expressway)" },
  ],
};

const MAX_TRAIN_PASSBYS = 8; // busiest hour in train_hourly_pattern, for normalising

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(collectReading(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    // --- manual collector trigger (unchanged) ---------------------------------
    if (pathname === "/run") {
      const key = request.headers.get("x-trigger-key");
      if (!env.TRIGGER_SECRET || key !== env.TRIGGER_SECRET) {
        return new Response("Forbidden", { status: 403 });
      }
      const results = await collectReading(env);
      return json(results);
    }

    // --- read-only JSON API --------------------------------------------------
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") return withCors(new Response(null, { status: 204 }));
      try {
        const res = await handleApi(pathname, url, env);
        return withCors(res);
      } catch (err) {
        console.log("API error:", err.message);
        return withCors(json({ error: "internal error" }, 500));
      }
    }

    // --- static React SPA --------------------------------------------------
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    // wrangler dev without a build present, or assets binding missing
    return new Response(
      "SeeNoise Worker is running. API under /api/*. Build web/ and deploy to serve the app.",
      { headers: { "content-type": "text/plain" } }
    );
  },
};

// ---------------------------------------------------------------------------
// API router
// ---------------------------------------------------------------------------

async function handleApi(pathname, url, env) {
  // GET /api/health
  if (pathname === "/api/health") {
    return json({ ok: true, ts: new Date().toISOString() });
  }

  // GET /api/meta/regions  ->  [{ state, city, count }]
  if (pathname === "/api/meta/regions") {
    const { results } = await env.DB
      .prepare(
        `SELECT state, city, COUNT(*) AS count
           FROM buildings
          GROUP BY state, city
          ORDER BY state, city`
      )
      .all();
    return json({ regions: results });
  }

  // GET /api/pilot  ->  the Petalz pilot building + its monitored sources
  if (pathname === "/api/pilot") {
    return json({ pilot: PILOT });
  }

  // GET /api/buildings?state=&city=&q=&limit=
  if (pathname === "/api/buildings") {
    const state = url.searchParams.get("state");
    const city = url.searchParams.get("city");
    const q = url.searchParams.get("q");
    const limit = clampInt(url.searchParams.get("limit"), 25, 1, 200);

    const where = [];
    const binds = [];
    if (state) { where.push("state = ?"); binds.push(state); }
    if (city) { where.push("city = ?"); binds.push(city); }
    if (q && q.trim().length >= 2) { where.push("name LIKE ?"); binds.push(`%${q.trim()}%`); }

    const sql =
      `SELECT osm_id, name, levels, lat, lon, state, city
         FROM buildings
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY (name IS NULL), name
        LIMIT ?`;
    binds.push(limit);

    const { results } = await env.DB.prepare(sql).bind(...binds).all();
    return json({ buildings: results.map(decorateBuilding), count: results.length });
  }

  // GET /api/buildings/:osm_id
  const buildingMatch = pathname.match(/^\/api\/buildings\/(\d+)$/);
  if (buildingMatch) {
    const row = await env.DB
      .prepare(`SELECT osm_id, name, levels, lat, lon, state, city FROM buildings WHERE osm_id = ?`)
      .bind(Number(buildingMatch[1]))
      .first();
    if (!row) return json({ error: "not found" }, 404);
    return json({ building: { ...decorateBuilding(row), monitoring: monitoringFor(row) } });
  }

  // GET /api/buildings/:osm_id/readings  — currently pilot-only (readings are
  // logged for the Petalz segments only), so this returns the shared readings
  // with a note when the building isn't the pilot.
  const readingsMatch = pathname.match(/^\/api\/buildings\/(\d+)\/readings$/);
  if (readingsMatch) {
    const hours = clampInt(url.searchParams.get("hours"), 48, 1, 24 * 14);
    const readings = await recentReadings(env, hours);
    return json({
      osm_id: Number(readingsMatch[1]),
      monitored: false,
      note: "Traffic/train readings are currently logged for the Petalz Residences pilot segments only. See /api/readings and /api/risk.",
      readings,
    });
  }

  // GET /api/readings?hours=48  — raw recent readings (all Petalz segments)
  if (pathname === "/api/readings") {
    const hours = clampInt(url.searchParams.get("hours"), 48, 1, 24 * 14);
    return json({ hours, readings: await recentReadings(env, hours) });
  }

  // GET /api/risk  — 24-hour RELATIVE noise-risk indicator for the pilot.
  // NOT a calibrated dB(A) value. See CLAUDE.md.
  if (pathname === "/api/risk") {
    return json(await pilotRisk(env));
  }

  return json({ error: "unknown endpoint" }, 404);
}

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

function decorateBuilding(row) {
  return {
    ...row,
    label: row.name || `${row.levels ?? "?"}-storey block · ${row.city} (#${String(row.osm_id).slice(-6)})`,
  };
}

// Only the pilot has monitored road/rail segments right now.
function monitoringFor(row) {
  const d = haversine(row.lat, row.lon, PILOT.lat, PILOT.lon);
  if (d < 60) {
    return { available: true, kind: "pilot", sources: PILOT.sources };
  }
  return {
    available: false,
    reason: "No monitored road/rail segments near this building yet. Only the Petalz Residences pilot is instrumented.",
  };
}

async function recentReadings(env, hours) {
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const { results } = await env.DB
    .prepare(
      `SELECT ts, segment, current_speed, free_flow_speed, speed_ratio,
              confidence, road_closure, train_passbys_this_hour
         FROM readings
        WHERE ts >= ?
        ORDER BY ts DESC`
    )
    .bind(since)
    .all();
  return results;
}

// Relative noise-risk indicator, 0..1, per hour of day (Malaysia local time).
// PLACEHOLDER FORMULA — see ADR-001 open decision #1. Blends:
//   roadFactor  = 1 - mean(speed_ratio) for that hour  (congestion proxy)
//   trainFactor = train pass-bys that hour / MAX_TRAIN_PASSBYS
// weighted 0.5 / 0.5. Explicitly uncalibrated.
async function pilotRisk(env) {
  const { results: readingRows } = await env.DB
    .prepare(
      `SELECT CAST((CAST(strftime('%H', ts) AS INTEGER) + 8) % 24 AS INTEGER) AS myt_hour,
              AVG(speed_ratio) AS avg_ratio,
              COUNT(*) AS samples
         FROM readings
        WHERE speed_ratio IS NOT NULL
        GROUP BY myt_hour`
    )
    .all();

  const { results: trainRows } = await env.DB
    .prepare(`SELECT hour, passbys FROM train_hourly_pattern`)
    .all();

  const ratioByHour = new Map(readingRows.map((r) => [r.myt_hour, r]));
  const trainByHour = new Map(trainRows.map((r) => [r.hour, r.passbys]));

  const W_ROAD = 0.5;
  const W_TRAIN = 0.5;

  const hours = [];
  for (let h = 0; h < 24; h++) {
    const r = ratioByHour.get(h);
    const passbys = trainByHour.get(h) ?? 0;
    const roadFactor = r && r.avg_ratio != null ? clamp(1 - r.avg_ratio, 0, 1) : null;
    const trainFactor = clamp(passbys / MAX_TRAIN_PASSBYS, 0, 1);
    const score =
      roadFactor == null
        ? W_TRAIN * trainFactor // no traffic data yet for this hour
        : W_ROAD * roadFactor + W_TRAIN * trainFactor;
    hours.push({
      hour: h,
      score: round2(score),
      road_factor: roadFactor == null ? null : round2(roadFactor),
      train_factor: round2(trainFactor),
      train_passbys: passbys,
      traffic_samples: r ? r.samples : 0,
    });
  }

  return {
    building: PILOT.name,
    calibrated: false,
    note: "Relative indicator only, not decibels. Placeholder formula (0.5 road congestion + 0.5 normalised train frequency). See ADR-001.",
    generated_at: new Date().toISOString(),
    hours,
  };
}

// ---------------------------------------------------------------------------
// Collector (unchanged behaviour)
// ---------------------------------------------------------------------------

async function collectReading(env) {
  const now = new Date();
  const ts = now.toISOString();

  // Malaysia is UTC+8, no DST.
  const mytHour = (now.getUTCHours() + 8) % 24;

  let passbys = null;
  try {
    const row = await env.DB
      .prepare("SELECT passbys FROM train_hourly_pattern WHERE hour = ?")
      .bind(mytHour)
      .first();
    passbys = row ? row.passbys : null;
  } catch (err) {
    console.log("train_hourly_pattern lookup failed:", err.message);
  }

  const results = [];

  for (const seg of SEGMENTS) {
    try {
      const flowUrl =
        `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json` +
        `?point=${seg.lat},${seg.lon}&unit=KMPH&key=${env.TOMTOM_API_KEY}`;

      const res = await fetch(flowUrl);
      if (!res.ok) {
        console.log(`TomTom error for ${seg.name}: ${res.status}`);
        results.push({ segment: seg.name, error: `HTTP ${res.status}` });
        continue;
      }

      const body = await res.json();
      const d = body.flowSegmentData;
      const speedRatio = d.freeFlowSpeed ? d.currentSpeed / d.freeFlowSpeed : null;

      await env.DB
        .prepare(
          `INSERT INTO readings
            (ts, segment, lat, lon, frc, current_speed, free_flow_speed,
             speed_ratio, confidence, road_closure, train_passbys_this_hour)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          ts,
          seg.name,
          seg.lat,
          seg.lon,
          d.frc ?? null,
          d.currentSpeed ?? null,
          d.freeFlowSpeed ?? null,
          speedRatio,
          d.confidence ?? null,
          d.roadClosure ? 1 : 0,
          passbys
        )
        .run();

      results.push({ segment: seg.name, currentSpeed: d.currentSpeed, freeFlowSpeed: d.freeFlowSpeed, speedRatio });
    } catch (err) {
      console.log(`Error collecting ${seg.name}:`, err.message);
      results.push({ segment: seg.name, error: err.message });
    }
  }

  return { ts, mytHour, passbys, results };
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// The API serves public, read-only data. CORS is open so the CRA dev server
// (localhost:3000) can call `wrangler dev` (localhost:8787) during development.
function withCors(res) {
  const h = new Headers(res.headers);
  h.set("access-control-allow-origin", "*");
  h.set("access-control-allow-methods", "GET, OPTIONS");
  h.set("access-control-allow-headers", "content-type");
  return new Response(res.body, { status: res.status, headers: h });
}

function clampInt(raw, fallback, min, max) {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
