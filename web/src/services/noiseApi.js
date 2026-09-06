// SeeNoise API client — talks to the Cloudflare Worker in ../../src/index.js.
//
// In production the React app is served by the same Worker, so the base URL is
// empty (same origin). In development the CRA dev server runs on :3000 and the
// Worker runs under `wrangler dev` on :8787, so point REACT_APP_NOISE_API_BASE
// at that. See web/.env.example.

const BASE = (process.env.REACT_APP_NOISE_API_BASE || '').replace(/\/$/, '');

async function get(path, params) {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
  }

  const res = await fetch(url.toString(), { headers: { accept: 'application/json' } });
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json()).error || '';
    } catch (_) {
      /* ignore */
    }
    throw new Error(`SeeNoise API ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  return res.json();
}

export const noiseApi = {
  health: () => get('/api/health'),

  // { regions: [{ state, city, count }] }
  regions: () => get('/api/meta/regions'),

  // { pilot: { osm_id, name, label, lat, lon, levels, ... } }
  pilot: () => get('/api/pilot'),

  // { segments: [{ id, name, ref, road_class, lat, lon, building_count, last_polled }] }
  segments: () => get('/api/segments'),

  // { buildings: [{ osm_id, name, label, levels, lat, lon, state, city, monitoring }], count }
  buildings: ({ state, city, q, limit } = {}) =>
    get('/api/buildings', { state, city, q, limit }),

  // { building: { ..., sources: [...], monitoring: { available, live, note } } }
  building: (osmId) => get(`/api/buildings/${osmId}`),

  // recent raw readings (all polled segments)
  readings: ({ hours } = {}) => get('/api/readings', { hours }),

  // readings for the polled segments near one building
  buildingReadings: (osmId, { hours } = {}) =>
    get(`/api/buildings/${osmId}/readings`, { hours }),

  // { osm_id, name, calibrated: false, sources, live_source_count,
  //   hours: [{ hour, score, road_component, rail_component }] }
  risk: (osmId) => get('/api/risk', { osm_id: osmId }),
};

export default noiseApi;
