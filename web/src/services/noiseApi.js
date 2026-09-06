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

  // { pilot: { id, name, lat, lon, levels, sources: [...] } }
  pilot: () => get('/api/pilot'),

  // { buildings: [{ osm_id, name, label, levels, lat, lon, state, city }], count }
  buildings: ({ state, city, q, limit } = {}) =>
    get('/api/buildings', { state, city, q, limit }),

  // { building: { ..., monitoring: { available, sources? , reason? } } }
  building: (osmId) => get(`/api/buildings/${osmId}`),

  // { hours, readings: [{ ts, segment, speed_ratio, train_passbys_this_hour, ... }] }
  readings: ({ hours } = {}) => get('/api/readings', { hours }),

  // { building, calibrated: false, hours: [{ hour, score, road_factor, train_factor, ... }] }
  risk: () => get('/api/risk'),
};

export default noiseApi;
