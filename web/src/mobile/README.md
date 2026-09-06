# Mobile display kit

The phone layout for SeeNoise and the primitives it's built from. Activated by
`useBreakpoint().isMobile` (viewport < 768 px) in `components/PlaceSearchApp.js`
— below that width the app renders `MobileShell` instead of the desktop
sidebar. Everything reads the same Redux state; the kit is purely
presentational.

## Pieces

| File | What it is |
|---|---|
| `useBreakpoint.js` | `{ isMobile, isTablet, isDesktop, sm/md/lg/xl, width }` from `matchMedia`. SSR-safe, updates on resize + orientation change. The single switch the rest of the app keys off. |
| `BottomSheet.js` | Dependency-free draggable sheet. Three snap points (`peek` 12 dvh · `half` 55 dvh · `full` 92 dvh). Drag the handle or header; a flick snaps in the direction of travel, a slow drag snaps to nearest. When `full` and the body is scrolled to the top, a downward drag collapses the sheet before the content scrolls. Tapping the handle cycles snaps. |
| `SegmentedControl.js` | iOS-style pill switch, 40 px min touch height. Used as the sheet header to switch panels. |
| `MobileShell.js` | Full-bleed `MapContainer` + floating app bar + `BottomSheet` holding three tabs: **Building** (`BuildingPicker`), **Noise** (`NoisePanel`), **More** (`PlaceAutocomplete` + `SearchHistory` + data credits). Picking a building auto-switches to Noise and lifts the sheet to at least `half`. |

## Tuning

- **Breakpoint** — change `md` (768) in `useBreakpoint.js` `QUERIES`, or just the
  `isMobile` derivation at the bottom.
- **Snap points** — `SNAP_VH` in `BottomSheet.js` (`dvh` fractions). `ORDER`
  controls the tap-to-cycle sequence.
- **Fling sensitivity** — the `velocity * 90` term in `settle()`.
- **Tabs** — `TABS` array in `MobileShell.js`.
- **Theme / status bar** — `theme_color` in `public/manifest.json` and the
  `theme-color` + `apple-mobile-web-app-status-bar-style` metas in
  `public/index.html`.

## Platform CSS (in `styles/globals.css`)

- `html, body, #root { height: 100% }` and, under `max-width: 767px`,
  `body { position: fixed; inset: 0; overflow: hidden }` — the shell owns the
  viewport; the document never scrolls behind it.
- `overscroll-behavior-y: none` on `body` — kills pull-to-refresh / rubber-band
  that would otherwise fight the sheet drag.
- Inputs forced to `font-size: 16px` on phones so iOS doesn't zoom on focus.
- `.safe-top` / `.safe-bottom` helpers and `spacing.safe-t` / `safe-b` Tailwind
  values wrap `env(safe-area-inset-*)` for notched devices; the shell and sheet
  already apply them.
- `screens.xs` (475 px) and `minHeight.touch` (44 px) added to
  `tailwind.config.js`.

## What it deliberately does NOT do

- No service worker / offline caching (CRA ships one unregistered; wire it up
  separately if you want installable-offline).
- No gesture library — the sheet is ~120 lines of pointer-event math. If you
  need spring physics or velocity trails, swap in `@use-gesture/react` +
  `react-spring` behind the same props.
- The desktop layout is untouched.
