# SeeNoise

See CLAUDE.md first for full project context. This file is just the
mechanical setup steps.

One Cloudflare Worker (`seenoise-collector`) does three things:

1. **Collector** — every 15 min, logs live traffic near Petalz Residences
   (NPE + Jalan Klang Lama) plus the expected KTM train pass-by count for
   that hour into Cloudflare D1.
2. **API** — read-only `/api/*` JSON over the same D1 (buildings list,
   pilot info, recent readings, 24-hour relative risk curve).
3. **Frontend** — serves the React app in `web/` (building picker + map +
   noise panel) via the `[assets]` binding.

See `docs/ADR-001-merge-seeplace-frontend.md` for how the frontend
(formerly the separate SeePlace repo) was merged in.

## Repo layout

```
src/index.js          Worker: scheduled() collector + /api router + SPA host
schema.sql etc.       D1 schema + seed (apply once, see below)
web/                  React app (CRA / react-scripts) — the frontend
wrangler.toml         Worker config; [assets] points at web/build
package.json          root scripts: build / deploy / dev:*
```

## Working on it

```bash
npm install            # root — also installs web/ deps (postinstall)

# Two terminals for local dev:
npm run dev:worker     # wrangler dev on :8787 (collector + /api, uses remote D1)
npm run dev:web        # CRA dev server on :3000
# set web/.env: REACT_APP_NOISE_API_BASE=http://localhost:8787
```

## One-time setup

```bash
npx wrangler login

# Create the D1 database
npx wrangler d1 create seenoise
# Copy the "database_id" from the output into wrangler.toml

# Apply the schema and seed data (order matters)
npx wrangler d1 execute seenoise --file=./schema.sql --remote
npx wrangler d1 execute seenoise --file=./seed.sql --remote
npx wrangler d1 execute seenoise --file=./buildings_schema.sql --remote
npx wrangler d1 execute seenoise --file=./buildings_seed.sql --remote
npx wrangler d1 execute seenoise --file=./sources_schema.sql --remote
npx wrangler d1 execute seenoise --file=./sources_seed.sql --remote   # building_sources + segments
npx wrangler d1 execute seenoise --file=./buildings_names_schema.sql --remote
npx wrangler d1 execute seenoise --file=./buildings_names_seed.sql --remote   # real building names

# Store your TomTom key as a secret -- get your own key at
# developer.tomtom.com with the "Traffic Flow API" product enabled,
# then run this and paste it when prompted. Never put the real key in
# wrangler.toml, .dev.vars, or anywhere that might get committed.
npx wrangler secret put TOMTOM_API_KEY

# Optional: a secret to protect the manual /run test endpoint
npx wrangler secret put TRIGGER_SECRET
```

Also set an HTTP-referrer restriction on the Google Maps API key for the
deployed `*.workers.dev` domain (and `localhost` for dev).

For local development, copy `.dev.vars.example` to `.dev.vars` (already
gitignored) and fill in your own key there instead of using secrets.

## Deploy

```bash
npm run deploy      # builds web/ then `wrangler deploy`
```

The cron trigger in `wrangler.toml` starts firing every 15 minutes on
Cloudflare's schedule automatically. `wrangler deploy` on its own works
too but won't rebuild the frontend first.

## Test it immediately (without waiting for the cron)

```bash
curl.exe -X POST https://seenoise-collector.claudefyp11.workers.dev/run \
  -H "x-trigger-key: <whatever you set TRIGGER_SECRET to>"
```

## API endpoints

```
GET /api/health
GET /api/meta/regions            state -> city list with counts
GET /api/pilot                   Petalz Residences (osm_id 961998795)
GET /api/segments                the ~22 road segments polled for live traffic
GET /api/buildings?state=&city=&q=&limit=   each row carries a `monitoring` summary
GET /api/buildings/:osm_id       + nearby noise `sources`
GET /api/buildings/:osm_id/readings?hours=  live readings for that building's segments
GET /api/readings?hours=         raw recent readings (all polled segments)
GET /api/risk?osm_id=            modelled 24-hour RELATIVE risk index for that building
```

## Refreshing the per-building noise sources

`building_sources` / `segments` come from OpenStreetMap via
`scripts/enrich-sources.mjs` (run locally — Overpass parsing would blow the
cron CPU budget). To rebuild:

```bash
npx wrangler d1 execute seenoise --remote --json \
  --command="SELECT osm_id,name,levels,lat,lon,state,city FROM buildings" > scripts/raw.json
# (extract the results array into scripts/buildings.json)
node scripts/enrich-sources.mjs           # writes sources_schema.sql + sources_seed.sql
npx wrangler d1 execute seenoise --file=./sources_seed.sql --remote
```

`scripts/ways.cache.json` caches the Overpass response — delete it to refetch.

## Check what's been logged

```bash
wrangler d1 execute seenoise --remote \
  --command="SELECT * FROM readings ORDER BY ts DESC LIMIT 20"

wrangler d1 execute seenoise --remote \
  --command="SELECT state, city, count(*) FROM buildings GROUP BY state, city ORDER BY count(*) DESC"
```

## Refreshing the train schedule later

`train_hourly_pattern` is a static lookup, not something the Worker
recomputes on its own (see CLAUDE.md for why). Re-pull the GTFS static
feed, recompute the hourly histogram, regenerate seed.sql, then:

```bash
wrangler d1 execute seenoise --remote --file=./seed.sql
```

## Notes

- Free-tier limits (D1: 5M row reads/day, 100K row writes/day, 5GB
  storage; Workers: 100K requests/day) are all far above what this
  project needs -- at 15-min intervals that's ~192 rows/day, and the
  1,118-row building seed is a one-time write.
- Cloudflare Cron Triggers don't auto-retry on failure. For a personal
  data-logging project, a missed 15-minute sample now and then isn't a
  big deal -- not worth adding retry infrastructure for.
