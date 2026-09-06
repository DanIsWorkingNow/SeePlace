# Migrating "Favorites" from the Spring Boot / MSSQL backend to D1

> Reference doc. Not yet applied. Written 2026-09-06.
>
> Source: `github.com/DanIsWorkingNow/SeePlaceFullstack` — a Spring Boot 3.1.5 /
> Java 21 / Maven backend whose **only** feature is a Favorites CRUD table on
> SQL Server, plus a React frontend with `favoritesSlice` / `favoritesSaga` /
> `FavoriteButton` / `FavoritesList`.
>
> Decision (see also ADR-001): **do not merge that backend.** Cloudflare
> Workers cannot run a JVM. The feature is one table + 5 endpoints; port it to
> the existing D1 database and the Worker's `/api` router instead. This doc is
> the how-to.

---

## 1. What the feature is

| Endpoint (Spring, under `/api`) | Purpose |
|---|---|
| `GET /favorites` | list active favorites, newest first |
| `POST /favorites` | add a favorite (409-ish if `place_id` already active) |
| `GET /favorites/{placeId}` | one favorite, or `{ isFavorite: false }` |
| `DELETE /favorites/{placeId}` | soft-delete (`is_active = 0`) |
| `GET /favorites/{placeId}/check` | `{ isFavorite: boolean }` |

Storage: a single `Favorites` table. No auth — one global list for all
visitors. Hibernate `ddl-auto=update` auto-creates the table on boot.

Frontend contract the React components rely on (keep these shapes):

```jsonc
// GET /api/favorites  -> array of:
{
  "id": 1,
  "placeId": "ChIJ...",
  "placeName": "KLCC",
  "placeAddress": "...",
  "latitude": 3.1579,
  "longitude": 101.7123,
  "placeTypes": "[\"tourist_attraction\"]",   // JSON string, not array
  "rating": 4.6,
  "photoReference": null,
  "notes": "",
  "isActive": true,
  "createdAt": "2026-09-06T06:24:29.263Z",
  "updatedAt": "2026-09-06T06:24:29.263Z"
}

// POST /api/favorites  body:
{ "placeId", "placeName", "placeAddress", "latitude", "longitude",
  "placeTypes", "rating", "photoReference", "notes" }
// POST response:  { "success": true, "message": "...", "data": { <favorite> } }

// GET /api/favorites/:placeId/check  ->  { "success": true, "isFavorite": true }
```

---

## 2. Type mapping — JPA/MSSQL → D1/SQLite

| Spring / MSSQL | D1 / SQLite | Note |
|---|---|---|
| `Long id`, `@GeneratedValue(IDENTITY)` | `INTEGER PRIMARY KEY AUTOINCREMENT` | |
| `String` (`@Column(length=…)`) | `TEXT` | SQLite ignores length; keep limits in Worker validation if you care |
| `BigDecimal latitude` (precision 10, scale 8) | `REAL` | SQLite has no `DECIMAL`. `REAL` = IEEE double — same as how `buildings.lat` / `readings.lat` are already stored. Precision is fine for coordinates. |
| `Boolean is_active` | `INTEGER` (`0`/`1`), `DEFAULT 1` | |
| `LocalDateTime created_at` (`@CreationTimestamp`) | `TEXT` (ISO-8601) | Set explicitly in the Worker with `new Date().toISOString()`. Do **not** use SQLite `DEFAULT CURRENT_TIMESTAMP` — it produces `YYYY-MM-DD HH:MM:SS`, not ISO, and the rest of this codebase uses `.toISOString()`. |
| `@Column(unique = true)` on `place_id` | `UNIQUE` | but see the soft-delete gotcha in §5 |
| `@CreationTimestamp` / `@UpdateTimestamp` | manual in Worker | no ORM hooks |
| Bean Validation (`@NotBlank`, `@NotNull`) | manual `if` checks in Worker | |
| `ddl-auto=update` (auto-migrate) | **explicit `.sql` files** applied via `wrangler d1 execute` | This is a feature, not a loss — migrations become versioned and reviewable, like `schema.sql` / `buildings_schema.sql` already are. |

---

## 3. Step-by-step

### Step 1 — schema file

Create `favorites_schema.sql` in the repo root (next to `schema.sql`):

```sql
-- Starred places. One global list (no auth yet). Ported from the
-- SeePlaceFullstack Spring Boot `Favorites` table — see
-- docs/favorites-d1-migration.md.
CREATE TABLE IF NOT EXISTS favorites (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id        TEXT NOT NULL UNIQUE,          -- Google Places place_id
  place_name      TEXT NOT NULL,
  place_address   TEXT,
  latitude        REAL NOT NULL,
  longitude       REAL NOT NULL,
  place_types     TEXT,                          -- JSON array stored as a string
  rating          REAL,
  photo_reference TEXT,
  notes           TEXT DEFAULT '',
  is_active       INTEGER NOT NULL DEFAULT 1,    -- 0 = soft-deleted
  created_at      TEXT NOT NULL,                 -- ISO-8601 UTC
  updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_favorites_active
  ON favorites(is_active, created_at DESC);
```

Apply it:

```bash
npx wrangler d1 execute seenoise --file=./favorites_schema.sql --remote
```

Add the same line to `README.md`'s "Apply the schema and seed data" block so a
fresh setup picks it up.

### Step 2 — Worker routes

`src/index.js` today calls `handleApi(pathname, url, env)` and the caller
already wraps the result in `withCors()` and catches errors. Two changes:

**2a.** Pass the request through so the handler can see the method and read the
body:

```js
// in fetch(), the /api branch:
const res = await handleApi(request, pathname, url, env);
```

```js
// signature:
async function handleApi(request, pathname, url, env) {
```
(update the existing GET-only handlers to ignore the new first arg, or just
re-order args — your call.)

**2b.** Add the favorites routes inside `handleApi`, before the final
`return json({ error: "unknown endpoint" }, 404)`:

```js
// ---- favorites ---------------------------------------------------------
if (pathname === "/api/favorites") {
  if (request.method === "GET") {
    const { results } = await env.DB
      .prepare(
        `SELECT * FROM favorites WHERE is_active = 1 ORDER BY created_at DESC`
      )
      .all();
    return json(results.map(rowToFavorite));
  }
  if (request.method === "POST") {
    const body = await request.json().catch(() => null);
    const err = validateFavorite(body);
    if (err) return json({ success: false, message: err }, 400);

    const now = new Date().toISOString();
    // UPSERT: re-favoriting a previously soft-deleted place reactivates it
    // instead of hitting the UNIQUE(place_id) constraint.
    await env.DB
      .prepare(
        `INSERT INTO favorites
           (place_id, place_name, place_address, latitude, longitude,
            place_types, rating, photo_reference, notes, is_active,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
         ON CONFLICT(place_id) DO UPDATE SET
           place_name      = excluded.place_name,
           place_address   = excluded.place_address,
           latitude        = excluded.latitude,
           longitude       = excluded.longitude,
           place_types     = excluded.place_types,
           rating          = excluded.rating,
           photo_reference = excluded.photo_reference,
           notes           = excluded.notes,
           is_active       = 1,
           updated_at      = excluded.updated_at`
      )
      .bind(
        body.placeId, body.placeName, body.placeAddress ?? null,
        Number(body.latitude), Number(body.longitude),
        body.placeTypes ?? null,
        body.rating != null ? Number(body.rating) : null,
        body.photoReference ?? null, body.notes ?? "",
        now, now
      )
      .run();

    const row = await env.DB
      .prepare(`SELECT * FROM favorites WHERE place_id = ?`)
      .bind(body.placeId)
      .first();
    return json(
      { success: true, message: "Place added to favorites", data: rowToFavorite(row) },
      201
    );
  }
}

const favMatch = pathname.match(/^\/api\/favorites\/([^/]+?)(\/check)?$/);
if (favMatch) {
  const placeId = decodeURIComponent(favMatch[1]);
  const isCheck = Boolean(favMatch[2]);

  if (request.method === "GET" && isCheck) {
    const row = await env.DB
      .prepare(`SELECT 1 FROM favorites WHERE place_id = ? AND is_active = 1 LIMIT 1`)
      .bind(placeId)
      .first();
    return json({ success: true, isFavorite: Boolean(row) });
  }
  if (request.method === "GET") {
    const row = await env.DB
      .prepare(`SELECT * FROM favorites WHERE place_id = ? AND is_active = 1`)
      .bind(placeId)
      .first();
    return json({
      success: true,
      isFavorite: Boolean(row),
      data: row ? rowToFavorite(row) : null,
    });
  }
  if (request.method === "DELETE") {
    const now = new Date().toISOString();
    const { meta } = await env.DB
      .prepare(
        `UPDATE favorites SET is_active = 0, updated_at = ?
          WHERE place_id = ? AND is_active = 1`
      )
      .bind(now, placeId)
      .run();
    if (!meta.changes) return json({ success: false, message: "Favorite not found" }, 404);
    return json({ success: true, message: "Favorite removed successfully" });
  }
}
```

Add these helpers next to the other small utilities in `src/index.js`:

```js
function rowToFavorite(r) {
  return {
    id: r.id,
    placeId: r.place_id,
    placeName: r.place_name,
    placeAddress: r.place_address,
    latitude: r.latitude,
    longitude: r.longitude,
    placeTypes: r.place_types,
    rating: r.rating,
    photoReference: r.photo_reference,
    notes: r.notes,
    isActive: Boolean(r.is_active),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function validateFavorite(b) {
  if (!b || typeof b !== "object") return "body required";
  if (!b.placeId || typeof b.placeId !== "string") return "placeId is required";
  if (!b.placeName || typeof b.placeName !== "string") return "placeName is required";
  if (b.latitude == null || Number.isNaN(Number(b.latitude))) return "latitude is required";
  if (b.longitude == null || Number.isNaN(Number(b.longitude))) return "longitude is required";
  return null;
}
```

The existing `/api` branch already adds `OPTIONS` handling and `withCors()`, so
CORS for `POST` / `DELETE` needs one tweak — widen the methods line in
`withCors()`:

```js
h.set("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
```

### Step 3 — frontend

Copy from `SeePlaceFullstack/frontend/src/` into `web/src/`:

| Copy | To |
|---|---|
| `services/favoritesAPI.js` | `web/src/services/favoritesAPI.js` |
| `store/slices/favoritesSlice.js` | `web/src/store/slices/favoritesSlice.js` |
| `store/sagas/favoritesSaga.js` | `web/src/store/sagas/favoritesSaga.js` |
| `FavoriteButton/FavoriteButton.js` | `web/src/components/FavoriteButton/FavoriteButton.js` |
| `components/FavoriteList/FavoritesList.js` | `web/src/components/FavoritesList/FavoritesList.js` |

Then:

1. **Repoint the API base** in `favoritesAPI.js`:

   ```js
   // was: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080/api'
   const API_BASE_URL = (process.env.REACT_APP_NOISE_API_BASE || '') ;   // same-origin Worker
   // ...
   this.baseURL = `${API_BASE_URL}/api/favorites`;
   ```
   (matches the `noiseApi.js` convention already in `web/`.)

2. **Wire the store** — `web/src/store/index.js`:

   ```js
   import favoritesReducer from './slices/favoritesSlice';
   // ...
   reducer: {
     places: placesReducer,
     ui: uiReducer,
     buildings: buildingsReducer,
     favorites: favoritesReducer,   // add
   },
   ```
   > Do **not** copy SeePlaceFullstack's `store/index.js` — it has dead
   > `combineReducers` / `rootSaga` redefinitions that never take effect and
   > `favorites` isn't actually in its real reducer map. The feature there may
   > never have run. Wire it by hand as above.

3. **Wire the saga** — `web/src/store/sagas/rootSaga.js`:

   ```js
   import favoritesSaga from './favoritesSaga';
   // ...
   yield all([
     fork(placesSaga),
     fork(buildingsSaga),
     fork(favoritesSaga),   // add
   ]);
   ```

4. **Place the components.** `FavoriteButton` takes a `place` prop (Google
   Places shape or a favorite) — drop it into `PlaceAutocomplete`'s suggestion
   rows and/or the map info card. `FavoritesList` takes `onPlaceSelect` — wire
   it to `usePlaces().selectPlace` so clicking a favorite pins it, and add it
   as a card in `PlaceSearchApp.js` next to `SearchHistory`.

### Step 4 — deploy

```bash
npx wrangler d1 execute seenoise --file=./favorites_schema.sql --remote
npm run deploy
```

### Step 5 — smoke test

```bash
B=https://seenoise-collector.claudefyp11.workers.dev

curl.exe -s "$B/api/favorites"                              # -> []
curl.exe -s -X POST "$B/api/favorites" -H "content-type: application/json" \
  -d '{"placeId":"test123","placeName":"KLCC","latitude":3.1579,"longitude":101.7123,"placeTypes":"[\"tourist_attraction\"]"}'
curl.exe -s "$B/api/favorites/test123/check"                # -> {"isFavorite":true}
curl.exe -s "$B/api/favorites"                              # -> [ {…} ]
curl.exe -s -X DELETE "$B/api/favorites/test123"            # -> {"success":true}
curl.exe -s "$B/api/favorites/test123/check"                # -> {"isFavorite":false}
# re-add the same id -> should reactivate, not 400:
curl.exe -s -X POST "$B/api/favorites" -H "content-type: application/json" \
  -d '{"placeId":"test123","placeName":"KLCC","latitude":3.1579,"longitude":101.7123}'
```

Then delete the test row: `npx wrangler d1 execute seenoise --remote --command="DELETE FROM favorites WHERE place_id='test123'"`.

---

## 4. Effort

~3–4 hours: schema (10 min), Worker routes (~1 h incl. the `handleApi` signature
change and testing), frontend copy + wiring (~1–2 h incl. placing the
components).

Versus the alternative — hosting a Spring Boot JVM + a managed SQL Server
alongside the Worker — which is days of setup and permanent operational
overhead for the identical result.

---

## 5. Gotchas / behaviour differences

- **Soft-delete + `UNIQUE(place_id)` is a latent bug in the original too.** The
  Spring version soft-deletes (row stays) but `existsByPlaceIdAndActive`
  guards `addFavorite`, so re-favoriting a removed place throws "Place already
  favorited" only if still active — actually it would hit the DB `UNIQUE`
  constraint on insert. The `ON CONFLICT … DO UPDATE` upsert in Step 2b fixes
  this cleanly: re-adding flips `is_active` back to `1`.
- **No ORM auto-migration.** Every future column change is a new `.sql` file +
  `wrangler d1 execute`. Keep them numbered/dated.
- **Timestamps are strings.** `created_at` / `updated_at` are ISO-8601 text.
  `FavoritesList` does `new Date(favorite.createdAt)` — ISO parses fine.
- **`place_types` is a JSON string, not an array**, on the wire and in the DB.
  `FavoriteButton` sends `JSON.stringify(place.types || [])`; `FavoritesList`
  does `JSON.parse(...)`. Keep it that way — don't "helpfully" parse it in the
  Worker.
- **Still one global list, no auth.** Same limitation as the Spring version.
  When SeeNoise gets user accounts, add a `user_id` column + `WHERE user_id = ?`
  and a `UNIQUE(user_id, place_id)` compound key.
- **D1 free-tier writes:** 100k/day. Favoriting is user-driven and tiny — no
  concern.
- **`GlobalExceptionHandler.java` in the source repo is an empty class.**
  Nothing to port. The Worker's existing `try/catch` in the `/api` branch
  covers it.

---

## 6. What NOT to bring over

- `SeePlaceFullstack/backend/` — the entire Spring Boot project. Not needed.
- `backend/target/` — compiled `.class` files were committed to that repo (18
  files, no backend `.gitignore`). Don't replicate.
- `application.properties` — contains a committed DB password
  (`seeplace_user` / `SeePlace123!`). If that account is real anywhere, rotate
  it. Never commit credentials; D1 needs none (the binding is in
  `wrangler.toml`, auth is the Cloudflare login).
- `config/DatabaseConfig.java`, `config/CorsConfig.java` — Spring plumbing with
  no D1 equivalent; CORS is already handled by `withCors()` in `src/index.js`.
