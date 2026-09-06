// SeeNoise Worker — data collector + read-only API + static frontend host
//
//   1. scheduled()  — every 15 min (see wrangler.toml). Polls TomTom Traffic
//      Flow for a rotating batch of road segments from the `segments` table
//      (not a hardcoded list any more), records one `readings` row each, and
//      stamps `segments.last_polled`.
//   2. fetch() /api/* — read-only JSON over D1: region list, building search,
//      per-building noise-source list, and a modelled 24-hour noise-risk
//      index for ANY building (not just the pilot).
//   3. fetch() everything else — serves the built React SPA (env.ASSETS).
//
// No GTFS parsing here (cron CPU budget — see CLAUDE.md). The 15-min job does
// a bounded number of fetches + a D1 batch. `/api/*` handlers are all single
// SELECTs on the request path (not the cron budget), keep them that way.

// How many segments to sample per cron run. segments.poll=1 rows are polled
// round-robin by last_polled, so each is sampled about every
// (segment_count / BATCH) * 15 min. Keeps well under the TomTom free tier and
// the cron CPU budget. Bump if you move to the Workers paid plan.
const SEGMENTS_PER_RUN = 8;

// ---- noise model constants (see /api/risk; ADR-001 open decision #1) --------

// Relative source loudness by road class / rail type, 0..1. Rough ordering
// from strategic-noise-mapping literature, NOT calibrated dB.
const ROAD_BASE = { motorway: 1.0, trunk: 0.82, primary: 0.66, secondary: 0.5, tertiary: 0.34 };
const RAIL_BASE = { rail: 0.72, light_rail: 0.62, monorail: 0.5, subway: 0.28 };

// Line-source distance attenuation: 1.0 at <=15 m, → 0 at >=300 m.
function atten(d) {
  const REF = 15, MAX = 300;
  if (d <= REF) return 1;
  if (d >= MAX) return 0;
  return 1 - Math.log10(d / REF) / Math.log10(MAX / REF);
}

// Standard diurnal road-traffic loudness, 0..1, indexed by Malaysia local hour.
// Used where we have no live speed data for a segment.
const ROAD_DIURNAL = [
  0.25, 0.18, 0.15, 0.15, 0.22, 0.40, 0.70, 0.95, 1.00, 0.85, 0.78, 0.78,
  0.80, 0.78, 0.78, 0.82, 0.88, 1.00, 0.98, 0.90, 0.75, 0.60, 0.45, 0.32,
];
// Diurnal transit-frequency proxy for LRT/MRT/monorail (no schedule table yet).
const TRANSIT_DIURNAL = [
  0.05, 0.0, 0.0, 0.0, 0.0, 0.3, 0.7, 1.0, 1.0, 0.7, 0.6, 0.6,
  0.6, 0.6, 0.6, 0.7, 0.85, 1.0, 1.0, 0.8, 0.6, 0.5, 0.35, 0.15,
];
const MAX_TRAIN_PASSBYS = 8; // busiest hour in train_hourly_pattern

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(collectReadings(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/run") {
      const key = request.headers.get("x-trigger-key");
      if (!env.TRIGGER_SECRET || key !== env.TRIGGER_SECRET) {
        return new Response("Forbidden", { status: 403 });
      }
      return json(await collectReadings(env));
    }

    if (pathname === "/api" || pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") return withCors(new Response(null, { status: 204 }));
      try {
        return withCors(await handleApi(request, pathname, url, env));
      } catch (err) {
        console.log("API error:", err.message);
        return withCors(json({ error: "internal error" }, 500));
      }
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("SeeNoise Worker is running. API under /api/*.", {
      headers: { "content-type": "text/plain" },
    });
  },
};

// ---------------------------------------------------------------------------
// API router
// ---------------------------------------------------------------------------

async function handleApi(request, pathname, url, env) {
  if (pathname === "/api/health") {
    return json({ ok: true, ts: new Date().toISOString() });
  }

  if (pathname === "/api/meta/regions") {
    const { results } = await env.DB
      .prepare(`SELECT state, city, COUNT(*) AS count FROM buildings
                GROUP BY state, city ORDER BY state, city`)
      .all();
    return json({ regions: results });
  }

  // The pilot building — kept for deep-linking. Now a real `buildings` row.
  if (pathname === "/api/pilot") {
    const row = await env.DB
      .prepare(`SELECT osm_id, name, block, name_source, levels, lat, lon, state, city FROM buildings WHERE osm_id = 961998795`)
      .first();
    return json({ pilot: row ? decorateBuilding(row) : null });
  }

  if (pathname === "/api/segments") {
    const { results } = await env.DB
      .prepare(`SELECT id, name, ref, road_class, lat, lon, poll, building_count, last_polled
                  FROM segments ORDER BY building_count DESC`)
      .all();
    return json({ segments: results });
  }

  if (pathname === "/api/buildings") {
    const state = url.searchParams.get("state");
    const city = url.searchParams.get("city");
    const q = url.searchParams.get("q");
    const limit = clampInt(url.searchParams.get("limit"), 25, 1, 200);

    const where = [];
    const binds = [];
    if (state) { where.push("b.state = ?"); binds.push(state); }
    if (city) { where.push("b.city = ?"); binds.push(city); }
    if (q && q.trim().length >= 2) { where.push("b.name LIKE ?"); binds.push(`%${q.trim()}%`); }

    const sql =
      `SELECT b.osm_id, b.name, b.block, b.name_source, b.levels, b.lat, b.lon, b.state, b.city,
              COUNT(s.osm_id)                         AS source_count,
              SUM(CASE WHEN s.segment_id IS NOT NULL THEN 1 ELSE 0 END) AS live_count
         FROM buildings b
         LEFT JOIN building_sources s ON s.osm_id = b.osm_id
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        GROUP BY b.osm_id
        ORDER BY (b.name IS NULL), b.name
        LIMIT ?`;
    binds.push(limit);

    const { results } = await env.DB.prepare(sql).bind(...binds).all();
    return json({
      buildings: results.map((r) => ({
        ...decorateBuilding(r),
        monitoring: monitoringSummary(r.source_count, r.live_count),
      })),
      count: results.length,
    });
  }

  const idMatch = pathname.match(/^\/api\/buildings\/(\d+)$/);
  if (idMatch) {
    const osmId = Number(idMatch[1]);
    const row = await env.DB
      .prepare(`SELECT osm_id, name, block, name_source, levels, lat, lon, state, city FROM buildings WHERE osm_id = ?`)
      .bind(osmId)
      .first();
    if (!row) return json({ error: "not found" }, 404);
    const { results: sources } = await env.DB
      .prepare(`SELECT kind, class, name, ref, distance_m, segment_id
                  FROM building_sources WHERE osm_id = ? ORDER BY distance_m`)
      .bind(osmId)
      .all();
    const live = sources.filter((s) => s.segment_id != null).length;
    return json({
      building: {
        ...decorateBuilding(row),
        sources,
        monitoring: monitoringSummary(sources.length, live),
      },
    });
  }

  const readingsMatch = pathname.match(/^\/api\/buildings\/(\d+)\/readings$/);
  if (readingsMatch) {
    const osmId = Number(readingsMatch[1]);
    const hours = clampInt(url.searchParams.get("hours"), 72, 1, 24 * 14);
    const since = isoHoursAgo(hours);
    const { results } = await env.DB
      .prepare(
        `SELECT r.ts, r.segment, r.segment_id, r.current_speed, r.free_flow_speed,
                r.speed_ratio, r.train_passbys_this_hour
           FROM readings r
          WHERE r.ts >= ?
            AND r.segment_id IN (
                  SELECT segment_id FROM building_sources
                   WHERE osm_id = ? AND segment_id IS NOT NULL)
          ORDER BY r.ts DESC`
      )
      .bind(since, osmId)
      .all();
    return json({ osm_id: osmId, hours, readings: results });
  }

  if (pathname === "/api/readings") {
    const hours = clampInt(url.searchParams.get("hours"), 48, 1, 24 * 14);
    const { results } = await env.DB
      .prepare(
        `SELECT ts, segment, segment_id, current_speed, free_flow_speed,
                speed_ratio, confidence, road_closure, train_passbys_this_hour
           FROM readings WHERE ts >= ? ORDER BY ts DESC`
      )
      .bind(isoHoursAgo(hours))
      .all();
    return json({ hours, readings: results });
  }

  // GET /api/risk?osm_id=NNN  — modelled 24-hour RELATIVE noise-risk index
  // (0..100) for ANY building. NOT calibrated dB(A). See CLAUDE.md.
  if (pathname === "/api/risk") {
    const osmId = Number(url.searchParams.get("osm_id"));
    if (!osmId) return json({ error: "osm_id query param required" }, 400);
    return json(await buildingRisk(env, osmId));
  }

  return json({ error: "unknown endpoint" }, 404);
}

// ---------------------------------------------------------------------------
// Noise-risk model
// ---------------------------------------------------------------------------

async function buildingRisk(env, osmId) {
  const building = await env.DB
    .prepare(`SELECT osm_id, name, levels, lat, lon FROM buildings WHERE osm_id = ?`)
    .bind(osmId)
    .first();
  if (!building) return { error: "building not found" };

  const { results: sources } = await env.DB
    .prepare(`SELECT kind, class, name, ref, distance_m, segment_id
                FROM building_sources WHERE osm_id = ? ORDER BY distance_m`)
    .bind(osmId)
    .all();

  // live avg speed_ratio per (segment_id, MYT hour) for this building's segments
  const segIds = [...new Set(sources.map((s) => s.segment_id).filter((x) => x != null))];
  const liveBySeg = new Map(); // segment_id -> { [hour]: avgRatio }
  if (segIds.length) {
    const placeholders = segIds.map(() => "?").join(",");
    const { results } = await env.DB
      .prepare(
        `SELECT segment_id,
                CAST((CAST(strftime('%H', ts) AS INTEGER) + 8) % 24 AS INTEGER) AS myt_hour,
                AVG(speed_ratio) AS avg_ratio
           FROM readings
          WHERE segment_id IN (${placeholders}) AND speed_ratio IS NOT NULL
          GROUP BY segment_id, myt_hour`
      )
      .bind(...segIds)
      .all();
    for (const r of results) {
      if (!liveBySeg.has(r.segment_id)) liveBySeg.set(r.segment_id, {});
      liveBySeg.get(r.segment_id)[r.myt_hour] = r.avg_ratio;
    }
  }

  const { results: trainRows } = await env.DB
    .prepare(`SELECT hour, passbys FROM train_hourly_pattern`)
    .all();
  const trainByHour = new Map(trainRows.map((r) => [r.hour, r.passbys]));

  const hours = [];
  for (let h = 0; h < 24; h++) {
    let roadComp = 0;
    let railComp = 0;
    for (const s of sources) {
      const a = atten(s.distance_m);
      if (a <= 0) continue;
      if (s.kind === "road") {
        const base = ROAD_BASE[s.class] ?? 0.3;
        const live = s.segment_id != null ? liveBySeg.get(s.segment_id)?.[h] : undefined;
        // slower traffic (low ratio) => stop-go => noisier; blend to a floor of 0.5
        const tf = live != null ? clamp(0.5 + 0.5 * (1 - live), 0.2, 1) : ROAD_DIURNAL[h];
        roadComp = combine(roadComp, base * a * tf);
      } else {
        const base = RAIL_BASE[s.class] ?? 0.5;
        let tf;
        if (s.class === "rail") {
          tf = (trainByHour.get(h) ?? 0) / MAX_TRAIN_PASSBYS; // KTM schedule
        } else {
          tf = TRANSIT_DIURNAL[h]; // LRT/MRT/monorail — no schedule table yet
        }
        railComp = combine(railComp, base * a * tf);
      }
    }
    const score = 100 * combine(roadComp, railComp);
    hours.push({
      hour: h,
      score: round1(score),
      road_component: round1(100 * roadComp),
      rail_component: round1(100 * railComp),
    });
  }

  const liveCount = sources.filter((s) => s.segment_id != null).length;
  return {
    osm_id: building.osm_id,
    name: building.name,
    levels: building.levels,
    calibrated: false,
    model:
      "Relative index 0-100. Per source: base(road class | rail type) x distance attenuation x " +
      "(live speed ratio where available, else diurnal profile | KTM train frequency). " +
      "Sources combined as 1-prod(1-c). Not decibels. Placeholder weights - see ADR-001.",
    sources: sources.map((s) => ({
      kind: s.kind, class: s.class, name: s.name, ref: s.ref,
      distance_m: s.distance_m, live: s.segment_id != null,
    })),
    live_source_count: liveCount,
    generated_at: new Date().toISOString(),
    hours,
  };
}

// probabilistic OR — saturating combine of two 0..1 factors
function combine(a, b) {
  return 1 - (1 - a) * (1 - b);
}

// ---------------------------------------------------------------------------
// Collector
// ---------------------------------------------------------------------------

async function collectReadings(env) {
  const now = new Date();
  const ts = now.toISOString();
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

  // round-robin: least-recently-polled segments first
  const { results: segs } = await env.DB
    .prepare(
      `SELECT id, name, ref, road_class, lat, lon
         FROM segments
        WHERE poll = 1
        ORDER BY (last_polled IS NULL) DESC, last_polled ASC
        LIMIT ?`
    )
    .bind(SEGMENTS_PER_RUN)
    .all();

  const results = [];
  const inserts = [];

  for (const seg of segs) {
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
      const d = (await res.json()).flowSegmentData;
      const speedRatio = d.freeFlowSpeed ? d.currentSpeed / d.freeFlowSpeed : null;

      inserts.push(
        env.DB
          .prepare(
            `INSERT INTO readings
               (ts, segment, segment_id, lat, lon, frc, current_speed, free_flow_speed,
                speed_ratio, confidence, road_closure, train_passbys_this_hour)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            ts, seg.name, seg.id, seg.lat, seg.lon,
            d.frc ?? null, d.currentSpeed ?? null, d.freeFlowSpeed ?? null,
            speedRatio, d.confidence ?? null, d.roadClosure ? 1 : 0, passbys
          )
      );
      inserts.push(
        env.DB.prepare(`UPDATE segments SET last_polled = ? WHERE id = ?`).bind(ts, seg.id)
      );
      results.push({ segment: seg.name, currentSpeed: d.currentSpeed, freeFlowSpeed: d.freeFlowSpeed, speedRatio });
    } catch (err) {
      console.log(`Error collecting ${seg.name}:`, err.message);
      results.push({ segment: seg.name, error: err.message });
    }
  }

  if (inserts.length) {
    try {
      await env.DB.batch(inserts);
    } catch (err) {
      console.log("D1 batch write failed:", err.message);
    }
  }

  return { ts, mytHour, passbys, polled: segs.length, results };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function decorateBuilding(row) {
  return {
    osm_id: row.osm_id,
    name: row.name,
    block: row.block ?? null,
    name_source: row.name_source ?? null,
    levels: row.levels,
    lat: row.lat,
    lon: row.lon,
    state: row.state,
    city: row.city,
    label: buildingLabel(row),
  };
}

// A name that tells you nothing about the development: "A", "B2", "Block C".
function isBareBlockName(name) {
  if (!name) return true;
  return /^(bloc?k|blok|blk|tower|menara|wing|fasa|phase)?\s*[-/]?\s*[a-z]?[-/]?\d{0,4}[a-z]?$/i.test(name.trim());
}

function buildingLabel(row) {
  const storeys = row.levels ? `${row.levels}-storey` : "block";
  const realName = row.name && !isBareBlockName(row.name) ? row.name : null;
  if (realName && row.block) return `${realName} — ${row.block}`;
  if (realName) return realName;
  if (row.block) return `${row.block} · ${storeys} · ${row.city}`;
  if (row.name) return `${row.name} · ${storeys} · ${row.city}`; // bare block name, no block col
  return `${storeys} · ${row.city} (#${String(row.osm_id).slice(-6)})`;
}

function monitoringSummary(sourceCount, liveCount) {
  const n = Number(sourceCount) || 0;
  const live = Number(liveCount) || 0;
  if (n === 0) {
    return {
      available: true,
      modelled: true,
      live: false,
      note: "No motorway, trunk, primary/secondary road or rail within 300 m — modelled traffic-noise exposure is low.",
    };
  }
  return {
    available: true,
    modelled: true,
    live: live > 0,
    live_source_count: live,
    note: live > 0
      ? "Modelled from nearby road/rail; some sources have live traffic data."
      : "Modelled from nearby road/rail proximity and a standard diurnal traffic profile (no live segment nearby yet).",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function withCors(res) {
  const h = new Headers(res.headers);
  h.set("access-control-allow-origin", "*");
  h.set("access-control-allow-methods", "GET, OPTIONS");
  h.set("access-control-allow-headers", "content-type");
  return new Response(res.body, { status: res.status, headers: h });
}

function isoHoursAgo(h) {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

function clampInt(raw, fallback, min, max) {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
