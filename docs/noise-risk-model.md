# The noise-risk model

What `/api/risk?osm_id=` computes, why, and how to make it better. Written
2026-09-06 alongside the "all buildings" rollout.

## TL;DR

For **every** building in `buildings` (not just the Petalz pilot), the Worker
returns a **relative noise-risk index, 0–100, per hour of day**. It is **not
calibrated decibels** — there are no ground-truth dB(A) measurements yet. It is
a *strategic-noise-map style estimate*: model the sources, don't measure the
receiver.

## Inputs

| Input | Source | Where |
|---|---|---|
| Nearby noise sources per building (road by class, rail by type, distance in m) | OpenStreetMap via Overpass | `building_sources` table, built by `scripts/enrich-sources.mjs` |
| Live road congestion | TomTom Traffic Flow API | `readings` table, ~22 `segments` polled round-robin by the cron |
| Train frequency by hour | KTM GTFS static feed | `train_hourly_pattern` table (24 rows) |
| Building height | OSM `building:levels` | `buildings.levels` (floor slider, frontend only) |

`building_sources` keeps, per building, the **nearest** way of each
`(kind, class)` within **300 m**: e.g. one `road/motorway`, one `road/primary`,
one `rail/rail`. 824 of 1,118 buildings have ≥1 source; the other ~294 sit in
quiet residential pockets and score near 0 (a valid result, not missing data).

## Formula

For building *b*, hour *h* (Malaysia local time):

```
for each source s in building_sources[b]:
    a(s)  = attenuation by distance                       # 1.0 at ≤15 m → 0 at ≥300 m
          = 1 - log10(d_s / 15) / log10(300 / 15)
    base(s):
        road:  motorway 1.00 · trunk 0.82 · primary 0.66 · secondary 0.50 · tertiary 0.34
        rail:  rail 0.72 · light_rail 0.62 · monorail 0.50 · subway 0.28
    time(s, h):
        road, live segment nearby:  0.5 + 0.5·(1 − mean speed_ratio at hour h)   # stop-go ⇒ louder
        road, no live segment:      ROAD_DIURNAL[h]        # fixed curve, rush-hour peaks
        rail = "rail" (KTM):        train_hourly_pattern[h] / 8
        rail = LRT/MRT/monorail:    TRANSIT_DIURNAL[h]     # no schedule table yet
    c(s) = base(s) · a(s) · time(s, h)

road_component = 1 − Π(1 − c(s))   over road sources        # probabilistic OR
rail_component = 1 − Π(1 − c(s))   over rail sources
score(b, h)    = 100 · (1 − (1 − road_component)·(1 − rail_component))
```

Floor adjustment (`0.9 + 0.25·floor/levels`) is applied **client-side only** in
`NoisePanel` and is explicitly labelled illustrative.

## What's defensible

- **Ordering by road class and distance** matches how traffic noise actually
  behaves (motorway ≫ residential; ~6 dB per distance doubling for a line
  source — the log attenuation curve approximates this).
- **Diurnal shape** (quiet 02:00–05:00, peaks ~08:00 and ~18:00) matches
  observed urban road-noise profiles.
- **Live congestion → louder** is directionally right for the low-speed,
  stop-go regime typical near these buildings; the `0.5 + 0.5·(1−ratio)` keeps
  it bounded.
- **KTM train frequency** is real data for the one line it covers.

## What's a placeholder / known weak

1. **All weights are guesses.** `base`, the attenuation reference distances,
   the 0.5/0.5 road/rail split inside `combine`, the congestion transfer
   function — none are fitted to anything. This is ADR-001 open decision #1.
2. **No calibration to dB(A).** The index is unitless. Turning it into a
   decibel prediction needs a measurement campaign or a public EIA noise
   report for a nearby site (CLAUDE.md next-step #6).
3. **One source per class per building.** A building flanked by two primary
   roads only counts the nearer one.
4. **Rail is KTM-only for schedule.** LRT/MRT/monorail/light_rail get a
   generic transit curve, not real headways. `subway` base is low on the
   assumption it's mostly tunnelled — not always true (e.g. elevated MRT).
5. **No screening / barriers / building geometry.** Real strategic noise maps
   (CNOSSOS-EU) model reflection, diffraction, ground absorption, façade
   effects. This does none of that.
6. **300 m cutoff and the 4 road classes** are arbitrary-ish. Tertiary roads
   are included in the model but were excluded from the Overpass pull's `ref`
   filter for segment selection.
7. **Live traffic is 22 segments, not per-building.** A building's "primary
   road" may be a *different* stretch than the polled segment on the same
   named road — congestion is assumed uniform along a named road.

## How to improve it, roughly in order of payoff

1. **Get one real measurement.** Even a phone SPL meter reading at Petalz at a
   known hour anchors the whole scale. Two or three at different distances/
   classes lets you fit `base` and the attenuation curve.
2. **Fit the diurnal curve to logged `readings`** once there are a few weeks —
   replace `ROAD_DIURNAL` with the actual mean `speed_ratio` shape per road
   class.
3. **Add LRT/MRT/monorail headway tables** (their GTFS is on data.gov.my too)
   → replace `TRANSIT_DIURNAL`.
4. **Multiple sources per class**, and per-building nearest *segment* rather
   than nearest *named road*, so live data attaches to the right stretch.
5. **Barrier/screening term** from OSM (`barrier=*`, building footprints
   between source and receiver) — the biggest single accuracy lever.
6. Then a per-building ML model (XGBoost per CLAUDE.md) with features:
   distance-to-source, road class, hour, train frequency, logged speed_ratio,
   floor, orientation.

## Files

- `src/index.js` — `buildingRisk()`, `ROAD_BASE`, `RAIL_BASE`, `atten()`,
  `ROAD_DIURNAL`, `TRANSIT_DIURNAL`, `combine()`
- `scripts/enrich-sources.mjs` — builds `building_sources` + `segments`
- `sources_schema.sql` / `sources_seed.sql` — generated D1 tables
