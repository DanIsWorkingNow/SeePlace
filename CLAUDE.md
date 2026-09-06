# SeeNoise — development guide

Read this before making changes. It captures decisions already made and
why, so they don't get silently re-litigated or re-broken.

## What this is

A system to predict noise-pollution exposure near high-rise apartments in
Malaysia, starting with Klang Valley. Rather than deploying physical
sensors, it infers noise exposure from public data proxies -- train
schedules, road traffic congestion, and distance to the source -- the
same general approach used for city-scale strategic noise mapping
elsewhere, adapted to what's actually available in Malaysia.

Pilot building: **Petalz Residences**, Jalan Klang Lama, Kuala Lumpur
(3.0843233, 101.6613956). Chosen because it's a real, lived-in worst
case: a KTM rail line ~89m away, a primary road (Jalan Klang Lama, B14)
~91m away, and a motorway (New Pantai Expressway, E10) ~95m away, all
within about 100m of the building.

## Current status

- [x] Feasibility validated -- real data sources found and test-pulled
      for the pilot building
- [x] Cloudflare Worker + D1 ingestion pipeline written and **deployed**
      2026-09-06 to the `claudefyp11@gmail.com` Cloudflare account as
      `seenoise-collector` (D1 `seenoise`, id
      `443b4e5f-766a-41b7-ae2f-b54d523d5802`). Cron firing every 15 min.
- [x] Seed dataset of 1,118 high-rise buildings across Klang Valley,
      pulled from OpenStreetMap, each with state + city assigned
- [x] React frontend merged in under `web/` (was the separate SeePlace
      repo). Same Worker serves the SPA via `[assets]` + a read-only
      `/api/*` JSON layer over D1. See docs/ADR-001.
- [ ] No real dB(A) ground-truth measurements yet -- the "noise risk
      score" is a relative indicator only, not a calibrated decibel value.
      The `/api/risk` formula is an explicit placeholder (ADR-001 open #1).
- [ ] Prediction model not yet built -- needs weeks of logged D1 data first
- [ ] Noise data covers the Petalz pilot only -- `SEGMENTS` in
      `src/index.js` is 2 hardcoded road points. The other 1,117 buildings
      have coordinates but no monitored segments (ADR-001 open #2).

## Architecture

```
KTM GTFS (data.gov.my)  -->  precomputed hourly lookup table (D1)
TomTom Traffic Flow API -->  Cloudflare Worker (cron, every 15 min) --> D1
OSM (buildings + roads + admin boundaries) --> one-time seed --> D1
```

**Why the GTFS parsing happens outside the Worker's hot path:** Workers
Free plan caps a Cron Trigger invocation at **10ms of CPU time**.
Unzipping and parsing the full daily KTM GTFS feed (stop_times.txt alone
is thousands of rows) would blow that budget. So the recurring 15-minute
job only does 2-4 lightweight fetches + a D1 insert -- trivial CPU. The
train-frequency-by-hour table (`train_hourly_pattern`) is a small static
24-row lookup, computed by re-running the GTFS pull locally (not in the
Worker) whenever the schedule needs refreshing. Don't move GTFS parsing
into the Worker's `scheduled()` handler without changing this constraint.

## Data sources

| Source | Endpoint | Notes |
|---|---|---|
| KTM schedule (static) | `https://api.data.gov.my/gtfs-static/ktmb` | Free, official, no key. Returns a GTFS zip. |
| KTM live positions | `https://api.data.gov.my/gtfs-realtime/vehicle-position/ktmb` | Free, GTFS-Realtime protobuf. Works, but positional precision has known gaps on some legacy KTM lines -- fine for "a train is due," not for precise timing. |
| Traffic flow | `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/{zoom}/json?point={lat},{lon}&unit=KMPH&key={key}` | Needs the "Traffic Flow API" product on the key. See gotcha below. |
| Roads, rail, buildings, admin boundaries | Overpass API (OpenStreetMap) | See mirror notes below. |

**Ruled out, don't re-investigate:** PLUS Malaysia (doesn't operate the
road next to the pilot building -- that's IJM's New Pantai Expressway,
a different concessionaire); no Malaysian highway operator publishes a
public traffic API, only consumer apps with CCTV feeds; KPKT/Commissioner
of Building does not publish a bulk open-data registry of high-rises --
JMB/MC records are siloed per local authority and often a paid,
per-request search (confirmed via DBKL's own site).

## Known gotchas

- **TomTom key "SeeNoise"** (created first) returns 403 Forbidden on
  every endpoint despite the dashboard showing the right products
  attached. Root cause was never found. **"My First API key" is the one
  that actually works** -- use that one, don't waste time debugging
  SeeNoise unless revisiting this specifically.
- **Overpass public mirrors are flaky.** `overpass-api.de` and its
  sub-mirrors frequently return 503 (busy) or 429 (rate limited).
  `https://maps.mail.ru/osm/tools/overpass/api/interpreter` was the most
  reliable during development. Always send a real `User-Agent` header --
  some mirrors reject the default one. Retry across 2-3 mirrors with a
  few seconds of backoff rather than failing on the first 503.
- **District ≠ city in Malaysia.** Daerah (district, OSM admin_level=6)
  is a state land-administration unit -- only 9 in Selangor. City/
  municipal council (PBT, admin_level=7) is the actual local government
  body, and one district can contain several: Daerah Petaling alone
  contains Petaling Jaya, Subang Jaya, and Shah Alam as three separate
  councils. Always assign "city" from admin_level=7 first; only fall
  back to admin_level=6 when no level-7 polygon contains the point
  (currently ~1% of buildings: parts of Sepang, Kuala Langat, Kuala
  Selangor). Kuala Lumpur and Putrajaya are federal territories with no
  further city-level subdivision -- city == state for those.
- **Buildings dataset is OSM, not a government registry.** No Malaysian
  government source publishes a bulk list of registered high-rises.
  Only ~37% of the 1,118 seeded buildings have an OSM `name` tag; the
  rest are unnamed blocks/towers (coordinates + level count only) -- the
  UI needs a sensible fallback label for those. The level filter
  (`building:levels` matching `^[1-9][0-9]$`) only catches clean 2-digit
  values -- it will miss buildings tagged with ranges ("10;12"),
  decimals, or 3+ digit values. That's a small, accepted gap, not a bug.

## Files

```
wrangler.toml              Worker config, cron schedule, D1 binding
src/index.js                The collector Worker (scheduled + manual /run trigger)
schema.sql                  readings + train_hourly_pattern tables
seed.sql                    Real KTM hourly pass-by counts for the pilot building
buildings_schema.sql        buildings table (state/city/lat/lon, indexed)
buildings_seed.sql          1,118-row Klang Valley high-rise seed (batched inserts)
data/klang_valley_highrises.csv   Same seed data as plain CSV, for inspection outside D1
README.md                   Human setup/deploy steps
```

## Setup

See README.md for the deploy sequence (`wrangler d1 create`, apply
schema + seed files, set secrets, `wrangler deploy`). Nothing in this
kit contains a live API key -- get your own TomTom key and set it via
`wrangler secret put TOMTOM_API_KEY`, don't hardcode it anywhere.

## Suggested next steps, roughly in order

1. Confirm the Worker is actually deployed and logging -- check
   `wrangler d1 execute seenoise --remote --command="SELECT count(*) FROM readings"`.
2. Let it log for at least a few days before trying to fit anything --
   a handful of readings can't show a daily pattern.
3. Add more road/rail segments per building as the buildings table gets
   used for real (currently only the 2 pilot segments near Petalz are
   hardcoded in `src/index.js`'s `SEGMENTS` array).
4. Replace the placeholder congestion curve in the UI mockup with real
   logged `speed_ratio` values once there's enough data.
5. Only then: train a per-building model (XGBoost is a reasonable
   starting point per the vertical-facade-noise research reviewed
   earlier) using distance-to-source, road class, time-of-day, and
   train-frequency as features.
6. Getting real dB(A) ground truth (even a short measurement campaign,
   or a public EIA noise report for a nearby development) is the
   actual blocker for turning the risk score into a calibrated decibel
   prediction -- flag this to the user if it comes up, don't assume
   it's solved.
