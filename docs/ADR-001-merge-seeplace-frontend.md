# ADR-001 — Merge SeePlace as the SeeNoise frontend

- **Status:** Accepted — scaffolded 2026-09-06 (see "Implementation status" below)
- **Date:** 2026-09-06
- **Deciders:** DanIsWorkingNow
- **Supersedes:** nothing
- **Related:** CLAUDE.md ("Real app frontend not yet built"), README.md

---

## Context

Two repos exist, each a half of one product:

| | **SeePlace** (`github.com/DanIsWorkingNow/SeePlace`) | **SeeNoise** (this repo) |
|---|---|---|
| Role | Frontend / map visualization | Backend / data pipeline |
| Stack | React 19, Redux Toolkit + Redux Saga, Tailwind 3, `react-scripts` 5 (CRA) | Cloudflare Worker + D1 |
| Does | Google Places autocomplete → Google Map with auto-pinned markers + search history | Cron every 15 min: TomTom traffic flow + KTM train pattern → D1; 1,118-row Klang Valley building lookup |
| Backend | **None.** `apiService.js`, `favoritesService.js`, `constants.js` are empty stubs. `.env.example` points at `http://localhost:8080/api` which does not exist. A `favoritesSlice` exists with no service behind it. | The entire project |
| Frontend | The entire project | **None.** Only a throwaway UI mockup was ever built. |
| Region | Malaysia / KL (map default `3.139, 101.686`) | Klang Valley (Petalz Residences pilot) |

SeePlace was clearly built anticipating a server (dead API base URL, empty service layer, favorites slice). SeeNoise is a server with no consumer. They are complementary, not overlapping.

### Forces

- SeeNoise's `buildings` table (`osm_id, name, levels, lat, lon, state, city`, indexed on `lat`, `lon`, `name`, and `(state, city)`) is exactly the shape a building-picker UI needs.
- SeeNoise's `readings` and `train_hourly_pattern` are the data a noise-risk visualization needs.
- SeePlace already has a working map container, marker/auto-pin logic, debounced-search saga orchestration, and error boundaries — all reusable for a building picker.
- Cloudflare Workers can serve static assets and JSON API routes from one deployment.
- The Workers Free plan caps a **Cron Trigger** invocation at 10 ms CPU. This constraint applies to `scheduled()` only — normal `fetch()` request handlers (where API routes live) are not on that budget.
- `readings` currently holds ~2 rows. Real noise/traffic data exists for **Petalz only** — `SEGMENTS` in `src/index.js` is hardcoded to two road points near Petalz. The other 1,117 buildings have coordinates but no associated road/rail segments yet.
- `react-scripts` 5 is end-of-life and unmaintained. A migration to Vite is deferred (see ADR-002, not yet written).

---

## Decision

**Consolidate into this repo. One Cloudflare Worker serves both the React SPA (via Workers static assets) and a read-only JSON API over the existing D1 database. The React app is added under `web/`. No second service, no separate origin, no CORS.**

### Target topology

```
                    ┌────────────────────────────────────┐
   web/ (SeePlace)  │      seenoise-collector  (Worker)   │
   npm run build  ─▶│  [assets]   → SPA static files      │
                    │  fetch():                           │
                    │    /run     → manual cron trigger   │  (existing)
                    │    /api/*   → JSON over D1 (new)     │
                    │    else     → env.ASSETS.fetch()    │
                    │  scheduled() → 15-min collector     │  (existing, unchanged)
                    └───────────────┬────────────────────┘
                                    │
                            D1: seenoise
              readings · buildings · train_hourly_pattern
```

### Repo layout after merge

```
C:\SeeNoise\
├── src/
│   └── index.js              Worker: scheduled() + fetch() (routes added)
├── web/                      ← SeePlace src/, public/, config moved here verbatim
│   ├── src/
│   ├── public/
│   ├── package.json          CRA app (react-scripts kept for now)
│   ├── tailwind.config.js
│   └── build/                gitignored; produced by `npm run build`, uploaded by wrangler
├── schema.sql
├── seed.sql
├── buildings_schema.sql
├── buildings_seed.sql
├── data/
├── wrangler.toml             [assets] block added
├── package.json              root: orchestrates web build + wrangler deploy
├── CLAUDE.md
└── docs/
    └── ADR-001-merge-seeplace-frontend.md
```

### `wrangler.toml` additions

```toml
# existing keys unchanged: name, main, compatibility_date, [triggers], [[d1_databases]]

[assets]
directory = "./web/build"
binding = "ASSETS"                              # env.ASSETS in the Worker
not_found_handling = "single-page-application"  # deep links → index.html
```

With both `main` and `[assets]` set, a request that matches a built static file is served directly; everything else invokes the Worker. The Worker explicitly routes `/api/*` and `/run`, and forwards all other paths to `env.ASSETS.fetch(request)` so the SPA shell (and its client-side router) handles them.

> Confirm the exact `[assets]` key names against the Wrangler version in use at build time — this API changed across Wrangler 3→4. As of Wrangler 4.129 the block above is correct.

### Worker route additions (`src/index.js`)

Current `fetch()` handles `/` and `/run`. Add, before the asset fallback:

| Method + path | Purpose | D1 query shape |
|---|---|---|
| `GET /api/buildings?state=&city=&q=&limit=` | Building picker list / autocomplete | `SELECT osm_id,name,levels,lat,lon,state,city FROM buildings WHERE (?1 IS NULL OR state=?1) AND (?2 IS NULL OR city=?2) AND (?3 IS NULL OR name LIKE ?3) ORDER BY name IS NULL, name LIMIT ?4` |
| `GET /api/buildings/:osm_id` | Single building detail | `SELECT * FROM buildings WHERE osm_id=?` |
| `GET /api/buildings/:osm_id/readings?hours=48` | Recent traffic+train readings near a building | `SELECT ts,segment,speed_ratio,current_speed,free_flow_speed,train_passbys_this_hour FROM readings WHERE ts >= ? ORDER BY ts DESC` (segment filtering added once per-building segments exist) |
| `GET /api/risk?osm_id=&hour=` | Relative noise-risk score by hour (derived, not calibrated dB) | joins `train_hourly_pattern` + latest `readings.speed_ratio` + distance-to-source constants |
| `GET /api/meta/regions` | `state → [city]` for the filter UI | `SELECT DISTINCT state, city FROM buildings ORDER BY state, city` |

All are `SELECT`-only, bound-parameter, single-statement — trivial CPU, safe on the request path. No new secret required (D1 binding already present). `/api/risk` returns an explicitly **relative** indicator; the response payload must carry a `"calibrated": false` flag so the UI never presents it as decibels (per CLAUDE.md).

### React app additions (under `web/src/`)

Mirror the existing Places feature slice-for-slice:

| New file | Mirrors | Responsibility |
|---|---|---|
| `services/noiseApi.js` | `services/googleMapsService.js` | `fetch()` wrapper for `/api/*`; base URL is `""` (same origin) in prod, `http://localhost:8787` (wrangler dev) in dev |
| `store/slices/buildingsSlice.js` | `store/slices/placesSlice.js` | `buildings[]`, `selectedBuilding`, `regionFilter`, `readings[]`, `riskByHour` |
| `store/sagas/buildingsSaga.js` | `store/sagas/placesSaga.js` | debounced building search, fetch-on-select for readings + risk |
| `components/BuildingPicker/` | `components/PlaceAutocomplete/` | state → city → building selector, backed by `/api/buildings` |
| `components/NoisePanel/` | (the old mockup) | risk-score-by-floor/hour chart from `/api/risk` + `/api/buildings/:id/readings` |

`store/sagas/rootSaga.js` gains `buildingsSaga` in its `all([])`. `store/index.js` adds `buildingsReducer`.

`MapContainer` is reused unchanged for rendering; a new effect plots the selected building + nearby rail/road/motorway source markers.

**Search UX:** `/api/buildings` name/region search is primary (free, on-domain). Google Places autocomplete is kept as a secondary "type any address" mode that geocodes then snaps to the nearest building via a bounding-box query. Only ~37% of buildings carry an OSM `name`; the picker labels the rest by `"{levels}-storey block · {city}"` + a short `osm_id` suffix.

### Secrets / env strategy — unchanged split

| Secret | Where it lives | Why |
|---|---|---|
| `REACT_APP_GOOGLE_MAPS_API_KEY` | Build-time env, baked into the client bundle | Google Maps JS API is a browser API. **Must** add an HTTP-referrer restriction for the new `*.workers.dev` (and any custom) domain. |
| `TOMTOM_API_KEY` | Worker secret (`wrangler secret put`) | Server-side only. Never moves to the client. Use the key labelled "My First API key" (the "SeeNoise" key 403s — see CLAUDE.md). |
| `TRIGGER_SECRET` | Worker secret | Gates `POST /run`. |

### Build / deploy flow

Root `package.json`:

```json
{
  "scripts": {
    "build": "cd web && npm ci && npm run build",
    "deploy": "npm run build && wrangler deploy",
    "dev:worker": "wrangler dev",
    "dev:web": "cd web && npm start"
  }
}
```

Local dev runs two processes: `wrangler dev` (Worker + D1 + `/api`) on `:8787`, and CRA dev server on `:3000` with `noiseApi` base URL pointed at `:8787`. Production is a single `npm run deploy`.

---

## Consequences

### Positive

- One deploy, one origin, no CORS, one place for logs.
- SeeNoise's data becomes visible/usable for the first time.
- SeePlace's dead backend layer (`favoritesService`, API base URL) gets a real server; `favoritesSlice` can persist to a new D1 `favorites` table later.
- The 15-min collector and its cron budget are untouched — new routes are on the request path.
- Reuses the entire SeePlace map + saga + error-boundary layer.

### Negative / accepted

- Repo now needs a Node build step **and** Wrangler. CI must run both.
- `react-scripts` 5 (EOL) is carried forward. Audit noise and no security patches until ADR-002 (Vite migration).
- The client bundle grows the Worker deployment; static assets are served by Cloudflare's asset host, not counted against Worker CPU, but the deploy artifact is larger.
- SeePlace's saga/service layer is heavily over-defensive ("corruption-proof" singleton, triple serialization guards). Inherited as-is.
- **Noise data is Petalz-only.** The picker can browse all 1,118 buildings, but `/api/risk` and `/api/buildings/:id/readings` are only meaningful for Petalz until per-building segments are added (CLAUDE.md next-step #3). UI must show a "no local data yet" state for every other building.
- `readings` is nearly empty; the noise panel will be sparse for weeks (CLAUDE.md next-step #2).

### Neutral

- Google Places API billing continues for the secondary address-search mode. Primary building search is free D1.

---

## Alternatives considered

### A. Cloudflare Pages for the frontend + separate Worker for the API

Pages hosts the React build; the existing Worker stays API-only; Pages Functions or a route proxies `/api`.
**Rejected:** two deployments to keep in sync, cross-origin between Pages domain and Worker domain (CORS config), and Pages + D1 binding is a second binding to manage. The single-Worker + `[assets]` model did not exist when this pattern was common; it now does and is simpler.

### B. Keep both repos, SeePlace calls SeeNoise over CORS

No merge; SeePlace deploys wherever, hits `seenoise-collector.workers.dev/api`.
**Rejected:** permanent CORS surface, two release cycles, secret/env split across two repos, and the "which repo owns the deploy" question never goes away. The projects are one product.

### C. Rebuild the frontend in Next.js on Cloudflare

Greenfield frontend, SSR, app router.
**Rejected:** throws away a working, already-debugged map/saga integration for framework churn. No SSR requirement here — it's an authenticated-free, map-centric SPA.

### D. Migrate to Vite as part of this merge

**Deferred, not rejected.** Correct eventually (`react-scripts` is EOL), but bundling it into the merge doubles the surface area of one change. Do the merge on CRA, get it green, then migrate build tooling as an isolated ADR-002.

---

## Implementation status (2026-09-06)

Done:

- [x] SeePlace copied to `web/` (`.git` and `.backup` files stripped)
- [x] Root `package.json` — `build` / `deploy` / `dev:worker` / `dev:web`
- [x] `.gitignore` — `web/build`, `web/node_modules`, `web/.env`
- [x] `wrangler.toml` — `[assets]` block (`directory = ./web/build`, `binding = ASSETS`, SPA fallback)
- [x] `src/index.js` — `/api/*` router + `env.ASSETS.fetch()` fallback; `/run` and `scheduled()` unchanged; open CORS on `/api` for dev
- [x] `web/src/services/noiseApi.js`
- [x] `web/src/store/slices/buildingsSlice.js`, `store/sagas/buildingsSaga.js`, wired into `rootSaga` + `store/index.js`
- [x] `web/src/hooks/useBuildings.js`
- [x] `web/src/components/BuildingPicker/`, `components/NoisePanel/`, wired into `PlaceSearchApp.js`
- [x] `web/src/components/common/Header.js` re-branded SeeNoise
- [x] `web/.env.example` — `REACT_APP_NOISE_API_BASE` convention
- [x] CLAUDE.md + README.md updated

Still to do (not blocking):

- [ ] `wrangler secret` — Google Maps key HTTP-referrer restriction for the deployed domain
- [ ] End-to-end smoke test against `wrangler dev` + a real build
- [ ] `/api/risk` formula review (open decision #1)
- [ ] `favoritesSlice` still stubbed (open decision #3)
- [ ] The repo is not a git repo yet — `git init` when ready

## Design notes from implementation

- **Petalz Residences is NOT in the `buildings` table.** The OSM seed query
  filtered on `building:levels`, which Petalz lacks. The Worker carries a
  hardcoded `PILOT` constant (coords, 34 levels, the 3 sources with their
  CLAUDE.md distances). `/api/risk` and the noise panel are pilot-only;
  every real building resolves `monitoring.available = false` with an
  explanatory reason. Nearest OSM building to Petalz is ~525 m away.
- **`/api/risk` returns all 24 hours in one call** (`{ calibrated: false, hours: [...] }`),
  not a single-hour lookup — simpler for the panel. Formula: `0.5 * (1 - mean speed_ratio) + 0.5 * (train_passbys / 8)`, per MYT hour. Placeholder.
- **Map reuse:** `BuildingPicker` selection dispatches the existing
  `places/selectPlace` with a synthesized place object, so `useGoogleMaps`
  auto-pins it with zero MapContainer changes.
- **`readings` are not building-scoped** (all rows are the 2 Petalz segments),
  so `/api/buildings/:osm_id/readings` returns the shared readings with a
  `monitored: false` note. Revisit when `building_segments` exists.

## Open decisions

1. **`/api/risk` formula.** What exactly combines `speed_ratio`, `train_passbys_this_hour`, and distance-to-source into the relative score? Needs its own short design note. Placeholder: normalized weighted sum, documented as uncalibrated.
2. **Per-building segments.** `SEGMENTS` is a hardcoded 2-element array. Before the picker is useful beyond Petalz, this needs to become a `building_segments` table (osm_id → list of {name, lat, lon, class}) that the collector iterates. Separate work item.
3. **Favorites.** Wire `favoritesSlice` to a real D1 `favorites` table now, or leave stubbed until there's auth? Leaning: leave stubbed — no user accounts yet.
4. **Custom domain** vs. `*.workers.dev` for launch.
