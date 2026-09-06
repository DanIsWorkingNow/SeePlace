// Fill in real apartment/condo names for buildings whose OSM `name` is NULL
// or a bare block label ("A", "B2", "36", "Block C"). Reverse-geocodes each
// against Google (result_type=premise), which knows most Malaysian condo and
// public-housing names ("Perumahan Awam Sri Sabah", "Tropicana City Tropics",
// "Apartment Putra Ria", ...).
//
// Runs LOCALLY. Emits:
//   buildings_names_schema.sql   (adds `block`, `name_source` columns)
//   buildings_names_seed.sql     (UPDATE buildings SET name/block/name_source ...)
//
// Usage:  GOOGLE_MAPS_API_KEY=... node scripts/enrich-names.mjs
//   (falls back to reading web/.env)
//
// Needs scripts/buildings.json (dump from D1 — see README).

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const KEY =
  process.env.GOOGLE_MAPS_API_KEY ||
  (() => {
    try {
      return readFileSync(join(ROOT, "web/.env"), "utf8")
        .match(/REACT_APP_GOOGLE_MAPS_API_KEY=(.+)/)?.[1]
        ?.trim();
    } catch {
      return null;
    }
  })();

if (!KEY) {
  console.error("No Google Maps key. Set GOOGLE_MAPS_API_KEY or web/.env.");
  process.exit(1);
}

const CACHE = join(HERE, "names.cache.json");
const BATCH = 12; // concurrent reverse-geocodes
const PAUSE_MS = 250; // between batches

// A name is "junk" (worth replacing) if it's empty or just a block token.
const JUNK = /^(blo?k\.?\s*|lot\s*|pt\s*|no\.?\s*)?[a-z]?[-/]?\d{0,4}[a-z]?$/i;
const JUNK_WORDED = /^(bloc?k|blok|blk|tower|menara|wing|fasa|phase|type|jenis)\s*[-/]?\s*[a-z0-9]{1,4}$/i;
function isJunk(name) {
  if (!name) return true;
  const n = name.trim();
  if (n.length <= 2) return true;
  return JUNK.test(n) || JUNK_WORDED.test(n);
}

// Pull "Block 54" / "Blok C" / "Tower A" off either end of a premise string.
function splitBlock(s) {
  const tail = s.match(/[\s,-]+(bloc?k|blok|blk|tower|menara)\s*([0-9]{1,4}[a-z]?|[a-z][0-9]?)\s*$/i);
  if (tail) {
    return {
      complex: s.slice(0, tail.index).replace(/[\s,-]+$/, "").trim(),
      block: `${cap(tail[1])} ${tail[2].toUpperCase()}`,
    };
  }
  const head = s.match(/^(bloc?k|blok|blk|tower|menara)\s*([0-9]{1,4}[a-z]?|[a-z][0-9]?)[\s,-]+(.+)/i);
  if (head) {
    return { complex: head[3].trim(), block: `${cap(head[1])} ${head[2].toUpperCase()}` };
  }
  return { complex: s.trim(), block: null };
}
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

// Normalise a bare block token: "block c" -> "Block C", "tower a" -> "Tower A",
// "A" -> "A", "m12" -> "M12".
function normBlock(s) {
  const t = s.trim().replace(/\s+/g, " ");
  const m = t.match(/^(bloc?k|blok|blk|tower|menara|wing|fasa|phase)\s*[-/]?\s*(.+)$/i);
  if (m) {
    const word = /^(tower|menara)$/i.test(m[1]) ? "Tower" : /^(wing)$/i.test(m[1]) ? "Wing" : /^(fasa|phase)$/i.test(m[1]) ? "Phase" : "Block";
    return `${word} ${m[2].toUpperCase()}`;
  }
  return t.toUpperCase();
}

const PLUS_CODE = /^[23456789cfghjmpqrvwx]{2,}\+[23456789cfghjmpqrvwx]{2,}/i;
const BARE_CATEGORY = /^(apartment|apartments|pangsapuri|kondominium|condominium|condo|flat|flats|rumah pangsa|residensi|residence|residences|court|tower|towers|menara|block|blok)$/i;
const NOT_RESIDENTIAL = /\b(station|stesen|lrt|mrt|ktm|sekolah|school|college|kolej|universiti|university|masjid|mosque|surau|temple|tokong|kuil|gereja|church|hospital|klinik|clinic|caltex|petronas|shell|bhp|petrol|mall|plaza|gallery|galleria|complex|kompleks|dewan|balai|padang|stadium|hentian|restaurant|restoran|kafe|cafe|lembaga|jabatan|kementerian|embassy|kedutaan|consulate|enterprise|\bent\b|sdn\.?\s*bhd|pejabat|kilang|factory|gudang|warehouse)\b/i;

// Is this premise string a real complex name (not a block token, plot, plus
// code, bare category word, or a non-residential POI)?
function looksLikeName(s) {
  if (!s) return false;
  const t = s.trim();
  if (t.length < 5) return false;
  if (!/[a-z]{3}/i.test(t)) return false;
  if (PLUS_CODE.test(t)) return false;
  if (isJunk(t)) return false;
  if (BARE_CATEGORY.test(t)) return false;
  if (/^(bloc?k|blok|blk|lot|pt|petak|unit|no)\b/i.test(t)) return false; // leading block token
  if (/^(jalan|lorong|persiaran|lebuh|lebuhraya)\b/i.test(t)) return false; // a street
  if (NOT_RESIDENTIAL.test(t)) return false;
  return true;
}

// Title-case, but keep short all-caps tokens (PPR, PJS, USJ, KL, UTM, TTDI...).
function tidy(s) {
  return s
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => {
      if (/^[A-Z0-9]{2,4}$/.test(w) || /^\d/.test(w)) return w;
      if (/^[A-Za-z]'[A-Za-z]/.test(w)) return w.charAt(0).toUpperCase() + w.slice(1); // Mont'Kiara
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

async function reverseGeocode(lat, lon) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const url =
        `https://maps.googleapis.com/maps/api/geocode/json` +
        `?latlng=${lat},${lon}&result_type=premise&language=en&key=${KEY}`;
      const res = await fetch(url);
      const j = await res.json();
      if (j.status === "OK") {
        const comp = j.results[0]?.address_components?.find((c) => c.types.includes("premise"));
        if (comp) return comp.long_name;
        return j.results[0]?.formatted_address?.split(",")[0] ?? null;
      }
      if (j.status === "ZERO_RESULTS") return null;
      if (j.status === "OVER_QUERY_LIMIT") {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      console.warn(`  geocode ${lat},${lon}: ${j.status} ${j.error_message ?? ""}`);
      return null;
    } catch (e) {
      await sleep(1000 * (attempt + 1));
    }
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const buildings = JSON.parse(readFileSync(join(HERE, "buildings.json"), "utf8"));
  const targets = buildings.filter((b) => isJunk(b.name));
  console.log(`${targets.length} / ${buildings.length} buildings need a name.`);

  let cache = {};
  try {
    cache = JSON.parse(readFileSync(CACHE, "utf8"));
    console.log(`  (${Object.keys(cache).length} cached)`);
  } catch { /* none */ }

  let done = 0;
  for (let i = 0; i < targets.length; i += BATCH) {
    const slice = targets.filter((b, k) => k >= i && k < i + BATCH && !(b.osm_id in cache));
    await Promise.all(
      slice.map(async (b) => {
        cache[b.osm_id] = (await reverseGeocode(b.lat, b.lon)) ?? "";
      })
    );
    done = Math.min(i + BATCH, targets.length);
    if (slice.length) {
      writeFileSync(CACHE, JSON.stringify(cache));
      process.stdout.write(`\r  ${done}/${targets.length}`);
      await sleep(PAUSE_MS);
    }
  }
  console.log("");

  // build updates
  const esc = (v) => (v == null || v === "" ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
  const updates = [];
  let named = 0, blockOnly = 0, unresolved = 0;

  // Policy: never destroy an existing OSM name. A Google complex name wins;
  // otherwise the row is left exactly as OSM had it (these UPDATEs restore the
  // original name too, so the seed is safe to re-run after an earlier version
  // that nulled names). A bare block token is also copied into `block`.
  for (const b of targets) {
    const raw = cache[b.osm_id];
    const oldBlock =
      b.name && isJunk(b.name) && b.name.trim().length <= 10 ? normBlock(b.name) : null;

    if (looksLikeName(raw)) {
      const { complex, block } = splitBlock(raw);
      if (looksLikeName(complex)) {
        updates.push(
          `UPDATE buildings SET name=${esc(tidy(complex))}, block=${esc(block || oldBlock)}, name_source='google' WHERE osm_id=${b.osm_id};`
        );
        named++;
        continue;
      }
    }
    if (b.name) {
      updates.push(
        `UPDATE buildings SET name=${esc(b.name)}, block=${esc(oldBlock)}, name_source='block' WHERE osm_id=${b.osm_id};`
      );
      blockOnly++;
    } else {
      unresolved++; // NULL name, nothing to restore
    }
  }

  writeFileSync(join(ROOT, "buildings_names_schema.sql"), `-- Adds naming provenance to the buildings table. Idempotent errors on re-run.
-- Generated by scripts/enrich-names.mjs.
ALTER TABLE buildings ADD COLUMN block TEXT;
ALTER TABLE buildings ADD COLUMN name_source TEXT;   -- 'osm' | 'google' | 'block' | NULL
`);

  writeFileSync(
    join(ROOT, "buildings_names_seed.sql"),
    `-- Generated by scripts/enrich-names.mjs. Real condo / public-housing names\n` +
    `-- reverse-geocoded from Google for buildings whose OSM name was missing or\n` +
    `-- a bare block label. ${named} named, ${blockOnly} block-only, ${unresolved} unresolved.\n\n` +
    `UPDATE buildings SET name_source='osm' WHERE name IS NOT NULL AND name_source IS NULL;\n\n` +
    updates.join("\n") + "\n"
  );

  console.log(`\nDone.`);
  console.log(`  named from Google:  ${named}`);
  console.log(`  block label only:   ${blockOnly}`);
  console.log(`  unresolved (NULL):  ${unresolved}`);
  console.log(`  wrote buildings_names_schema.sql, buildings_names_seed.sql`);
}

main().catch((e) => { console.error(e); process.exit(1); });
