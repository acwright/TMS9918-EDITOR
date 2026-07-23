# TMS9918 Character & Screen Editor — Implementation Plan

A multi-phase plan for building a character set and screen editor for the TMS9918 VDP.
This document is the source of truth across agent sessions. **Update the checkboxes and
"Current Status" section as work progresses.**

---

## Current Status

- **Active phase:** Phase 10 (Phases 1–9 complete)
- **Last updated:** 2026-07-23
- Phase 2 domain layer lives in `src/domain/` (types, modes, palette, factory, charOps,
  screenOps, ca65, commands, serialization) with specs in `src/domain/__tests__/`.
- Phase 3: `src/persistence/repository.ts` (localStorage), `src/stores/projects.ts` (Pinia,
  autosave/dirty flag), project manager UI in `ProjectManagerView` + `NewProjectDialog`.
  Note: `vitest.setup.ts` polyfills localStorage (Node's experimental webstorage shadows jsdom's).
- Phase 4: `src/stores/editor.ts` (selection + global CommandHistory; all project mutations
  go through it), `src/domain/colors.ts` (per-mode row-color resolution), editor components
  in `src/components/editor/`. Undo/redo buttons live in the app bar for now (move to the
  screen toolbar in Phase 7). Transform tooltips get shortcuts in Phase 8.
- Phase 5: `CharsetPicker.vue` (canvas 8×32, click-select ring, GMII set paginator),
  `ProjectSettingsDialog.vue` (mirrored↔independent conversion). Conversion is an undoable
  command (`editor.setG2CharsetMode`). Editor layout is viewport-height; the left column
  (aside) is the single scroll container. Charset picker renders as two side-by-side 8×16
  halves (0–127 / 128–255) — a *half-row* = one Graphics I color group.
- Phase 6: `ColorPicker.vue` (2×8, F/B badges, checkerboard transparent via `bg-checker`
  utility, F/B tap-target toggle for touch). Color state in editor store: `selectedRow`,
  `activeColors`, `setColor` (undoable, captures target slot). GMII row chips live in
  `CharacterPanel`; auto-follow happens in `paintPixel`. G1 group highlight in `CharsetGrid`.
- Phase 7: `ScreenPanel.vue` (toolbar + rename/delete dialogs, zoom 1×–8× + grid overlay as
  local view state) and `ScreenCanvas.vue` (paint/erase strokes, GMII thirds via
  `charsetForRow`). Screen state/commands in editor store: `selectedScreen`, `paintCell`,
  `screenTransform`, `addScreen`/`removeScreen`/`renameScreen` (all undoable; last screen
  can't be deleted). Undo/redo moved from the app bar into the screen toolbar.
- Phase 8: full shortcut map in `EditorView.onKeydown` (documented in README);
  `src/utils/platform.ts` gives ⌘/⌥/⇧ labels on Mac. Screen zoom/grid state moved into the
  editor store (`screenScale`, `showGrid`, `zoomScreen`/`fitScreenScale`/`toggleGrid`) so
  shortcuts drive them; ScreenPanel keeps only the auto-fit measurement (now a ResizeObserver,
  which also re-fits when the Screen tab becomes visible). `AppTooltip` is a Teleport-to-body
  tooltip driven by a reactive `visible` flag (escapes overflow clipping; forwards `$attrs`
  to its anchor since it has two root nodes). Footer on the manager view.
- Phase 9: responsive tabs below `lg` (Character / Screen) in `EditorView`; side-by-side at
  `lg`+. PixelEditor & ScreenCanvas use container-level pointer math + `setPointerCapture` so
  touch drags paint across cells (per-cell `pointerenter` doesn't fire on touch). AppButton
  hit targets grow to 40px on `pointer-coarse`. F/B toggle (Phase 6) covers touch's missing
  right-click for colors; on the screen editor, erase-on-touch is done by painting char 0.
- Phase 10: `src/samples/` — three bundled sample projects (one per mode) authored as ASCII
  art, loadable from the manager's "Load a Sample" row (`store.createFrom`). Full README
  rewrite. Remaining before release (need the user): capture `docs/screenshot.png`, pick a
  license, push to GitHub + verify Pages, tag `v0.1.0`.
- Note: Pages deployment is configured but unverified — the repo has no GitHub remote yet.
  Verify the workflow after the first push (also enable Pages via repo Settings → Pages → Source: GitHub Actions).

---

## 1. Product Summary

A single-page web application for creating and editing TMS9918 character sets and screen
maps. Users manage multiple project files (persisted in browser localStorage, plus
download/upload as JSON), each targeting one of three VDP modes:

| Mode | Screen grid | Cell size | Character sets | Color model |
|---|---|---|---|---|
| Text Mode | 40 × 24 | 6 × 8 px | 1 × 256 chars | One global fg/bg pair |
| Graphics Mode I | 32 × 24 | 8 × 8 px | 1 × 256 chars | fg/bg pair per character-set row (8 chars/group, 32 groups — matches HW color table) |
| Graphics Mode II | 32 × 24 | 8 × 8 px | 1 × 256 mirrored **or** 3 × 256 independent (screen thirds) | fg/bg pair per pixel row of each character (8 pairs/char — matches HW) |

Out of scope for now: **Import/Export implementation** (UI button exists, disabled/stub)
and **Multicolor Mode**.

## 2. Confirmed Design Decisions

These were discussed and settled — do not re-litigate without user input:

1. **GMII charset arrangement is a project setting, convertible later.**
   Chosen at project creation (mirrored vs. independent). Converting mirrored → independent
   copies the single set ×3. Converting independent → mirrored keeps set 1 and discards
   sets 2–3 **with a confirmation warning**.
2. **GMII per-row color UI: row chips + auto-follow.**
   A two-color chip sits to the right of each of the 8 pixel-editor rows showing that row's
   fg/bg. Clicking a chip targets that row in the color picker. Additionally, drawing or
   clicking pixels in a row auto-targets that row. The targeted row gets a subtle highlight.
3. **Global undo/redo.** One project-wide undo stack covering pixel edits, character
   transforms, color changes, charset operations, and screen edits. Ctrl/Cmd+Z / Shift+Ctrl/Cmd+Z
   everywhere. (The screen toolbar undo/redo buttons drive the same stack.)

## 3. Technology Stack

- **Framework:** Vue 3 (Composition API, `<script setup>`) + TypeScript, built with **Vite**
- **State:** Pinia
- **Routing:** Vue Router (two routes: project manager `/`, editor `/edit/:projectId`)
- **Icons:** [Lucide](https://lucide.dev) (`lucide-vue-next`) — clean, modern, tree-shakeable
- **Font:** Bebas Neue (self-hosted via `@fontsource/bebas-neue` for headings/UI chrome;
  a system/mono stack for body text and the ca65 byte box — Bebas Neue is display-only and
  poor for dense data)
- **Rendering:** HTML5 `<canvas>` for the screen editor and character-set grid (perf at
  32×24×64px cells); DOM grid is acceptable for the 8×8 pixel editor
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite`). Theme tokens (grayscale scale,
  TMS9918 palette) defined with `@theme` as CSS custom properties. Mostly black/white/grayscale;
  color reserved for the TMS9918 palette itself and small accents. Utility classes stay
  manageable because chrome is centralized in base components (`AppButton`, etc.)
- **Testing:** Vitest for domain logic (transforms, serialization, undo); component tests optional
- **Deploy:** GitHub Pages via GitHub Actions workflow (`vite build` with correct `base`)

## 4. TMS9918 Domain Reference

### 4.1 Palette (15 colors + transparent)

The color picker is a 2×8 grid (16 swatches). Approximate sRGB values:

| # | Name | Hex | # | Name | Hex |
|---|---|---|---|---|---|
| 0 | Transparent | (checkerboard) | 8 | Medium Red | `#FF6E63` |
| 1 | Black | `#000000` | 9 | Light Red | `#FF897D` |
| 2 | Medium Green | `#3EB849` | 10 | Dark Yellow | `#CCC35E` |
| 3 | Light Green | `#74D07D` | 11 | Light Yellow | `#DED087` |
| 4 | Dark Blue | `#5955E0` | 12 | Dark Green | `#3AA241` |
| 5 | Light Blue | `#8076F1` | 13 | Magenta | `#B766B5` |
| 6 | Dark Red | `#B95E51` | 14 | Gray | `#CCCCCC` |
| 7 | Cyan | `#65DBEF` | 15 | White | `#FFFFFF` |

Transparent renders as a small checkerboard swatch; on-screen it renders as the app's
neutral background.

### 4.2 Mode notes

- **Text Mode:** only the leftmost **6** pixel columns of each 8×8 pattern are displayed.
  The pixel editor must dim/hatch columns 6–7 and exclude them from the screen render,
  but the bytes still store all 8 bits (ca65 output unaffected).
- **Graphics I:** hardware color table = 32 bytes, each covering 8 consecutive characters.
  With the charset picker laid out 8-wide × 32-tall, **each picker row = one color group**.
- **Graphics II:** pattern and color tables are 8 bytes per character; each pattern byte
  row has its own fg/bg nibble pair. Screen is split into three 256-char thirds
  (rows 0–7, 8–15, 16–23) which may share one charset (mirrored) or use independent ones.

## 5. Data Model (Project File JSON)

```jsonc
{
  "version": 1,
  "id": "uuid",                    // storage key
  "name": "My Project",
  "type": "text" | "graphics1" | "graphics2",
  "createdAt": "ISO-8601",
  "modifiedAt": "ISO-8601",
  "settings": {
    "g2CharsetMode": "mirrored" | "independent"   // graphics2 only
  },
  // 1 charset for text/graphics1/mirrored-g2; 3 for independent-g2.
  // Each charset: 256 chars × 8 bytes (pattern rows, MSB = leftmost pixel).
  "charsets": [ [ [0,0,0,0,0,0,0,0], ... ×256 ], ... ],
  "colors": {
    // text:      { "fg": 15, "bg": 4 }
    // graphics1: { "groups": [ {"fg":15,"bg":1}, ... ×32 ] }        // one per picker row
    // graphics2: { "rows": [ [ {"fg":15,"bg":1} ×8 ] ×256 ] ×(1|3) }// per char per pixel row, per charset
  },
  "screens": [
    { "name": "Screen 1", "cells": [ /* charCode ints, row-major, 768 or 960 */ ] }
  ]
}
```

- localStorage layout: an index key (`tms9918-editor:projects` → array of `{id, name, type, modifiedAt}`)
  plus one key per project (`tms9918-editor:project:<id>`). Guard against quota errors with
  a user-visible warning.
- Download/upload uses the same JSON, pretty-printed, `.tms9918.json` extension suggested.
- All mutations go through a **command layer** (do/undo pairs) from day one — this is what
  makes global undo (Decision 3) tractable. Commands are granular but drag-strokes coalesce
  into a single undo entry.

## 6. UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│ App bar: project name · save state · back to projects        │
├───────────────────────────┬──────────────────────────────────┤
│ Pixel editor (8×8)  [row  │  Screen toolbar (centered):      │
│ chips in GMII]  Color     │  share · scale · grid · rotate · │
│ picker (2×8, F/B badges)  │  flip · shift · clear · fill ·   │
│ Transform button rows     │  undo · redo · screen paginator  │
│ ca65 byte box (copyable)  ├──────────────────────────────────┤
│ 3×3 wallpaper preview     │                                  │
├───────────────────────────┤  Screen editor canvas            │
│ Charset picker 8×32       │  (32×24 or 40×24, scrollable,    │
│ (scrollable; GMII set     │  1×–8× scale)                    │
│ paginator when            │                                  │
│ independent)              │                                  │
└───────────────────────────┴──────────────────────────────────┘
```

Every button: Lucide icon + tooltip showing label **and keyboard shortcut**.

---

## 7. Phases

### Phase 1 — Scaffold & Foundation
- [x] `create-vue` scaffold → Vue 3 + TS + Pinia + Router + Vitest + ESLint/oxlint/Prettier;
      added `lucide-vue-next`, `@fontsource/bebas-neue`
- [x] Tailwind CSS v4 via `@tailwindcss/vite`; `@theme` tokens in `src/assets/main.css`
      (grayscale `ink-*` scale, TMS9918 `vdp-*` palette, `font-display` = Bebas Neue)
- [x] ESLint + Prettier + Vitest configured; `npm run dev/build/test:unit/lint` all work
- [x] Base components in `src/components/base/`: `AppButton`, `AppTooltip`, `AppDialog`
- [x] GitHub Actions workflow (`.github/workflows/deploy.yml`): lint + test + build with
      `VITE_BASE=/<repo>/`, SPA 404 fallback, deploy to Pages
- [x] `git init`, initial commit
- **Exit criteria:** blank app with theme + one tooltipped button deploys to Pages.

### Phase 2 — Domain Core (no UI)
- [x] Types for the project schema (§5), palette constants (§4.1), mode metadata (§1 dims/cell sizes)
- [x] Project factory per mode (sensible defaults: blank charset, fg=white/bg=black-equivalents, one empty screen)
- [x] Character ops as pure functions: set/clear pixel, fill, clear, invert, shift L/R/U/D (wrap), rotate L/R, flip H/V
- [x] Screen ops as pure functions: set/clear cell, fill, clear, shift L/R/U/D (wrap), rotate L/R (see note), flip H/V
- [x] ca65 formatter: `.byte $XX, $XX, ...` for a character
- [x] Command layer: `Command {do, undo, label}`, history stack with coalescing for drag strokes
      (batch API: `beginBatch`/`endBatch`; undo mid-batch commits the open batch first)
- [x] Serialization: to/from JSON with `version` field + validation of uploaded files
- [x] Vitest coverage for all of the above (76 domain tests)
- **Exit criteria:** all domain tests green; no UI changes.
- **Note:** rotating a non-square screen (32×24) can't rotate in place — rotate the *content*
  within the same bounds (cells falling outside are dropped, vacated cells cleared). Flag in UI copy.

### Phase 3 — Persistence & Project Manager View
- [x] localStorage repository (index + per-project keys, quota-error handling; compact JSON
      in storage, pretty JSON for downloads; corrupt entries tolerated)
- [x] Pinia store: project list, load/save/autosave (debounced on mutation), dirty flag
      (`saveState`: saved/saving/unsaved; `markDirty()` is the hook for later editor phases)
- [x] Project manager view (landing page `/`): card/list of projects with name, mode badge, modified date
- [x] New-project dialog: name, mode picker (Text / Graphics I / Graphics II), GMII charset-mode
      choice (mirrored vs. independent) shown only for GMII
- [x] Rename, duplicate, delete (with confirm) actions
- [x] Download project as JSON; upload JSON (validated, rejected with a clear error if malformed)
- [x] Opening a project routes to `/edit/:projectId` (editor header shows name, mode, save state)
- **Exit criteria:** full project lifecycle works across page reloads; bad uploads rejected gracefully.

### Phase 4 — Character Pixel Editor
- [x] 8×8 grid editor bound to selected character: left-click/drag draws, right-click/drag erases
      (per PROMPT: click toggles pixel on/off in fg color; drags draw); context-menu suppressed
- [x] Pixels render in current fg color; unset pixels in current bg color (per active mode's color model)
- [x] Text Mode: columns 6–7 visually dimmed/hatched (§4.2)
- [x] Transform buttons (ordered): fill · clear · invert | shift L/R/U/D | rotate L/R | flip H/V — all via command layer
- [x] ca65 byte box, updates live, copy-to-clipboard button with success feedback
- [x] 3×3 wallpaper preview of the current character (live)
- **Exit criteria:** edit a character end-to-end with undo/redo working for every operation.

### Phase 5 — Character Set Picker
- [x] 8-wide × 32-tall canvas grid rendering all 256 chars with their mode-correct colors
- [x] Click selects character (highlight ring) → pixel editor + screen-draw brush
- [x] Live re-render as the current character is edited
- [x] GMII independent mode: 3-set paginator (Set 1/2/3 = screen top/middle/bottom); hidden otherwise
- [x] GMII setting conversion UI (project settings dialog): mirrored↔independent per Decision 1,
      with destructive-change warning (undoable command; warning shown before converting)
- **Exit criteria:** selection flows to pixel editor; GMII paging + conversion work.

### Phase 6 — Color System
- [x] 2×8 color picker: 16 swatches, transparent as checkerboard, **F**/**B** badges overlaid
      on current fg/bg swatches (badge contrast handled for light/dark swatches)
- [x] Left-click sets foreground; right-click sets background (plus small F/B mode toggle for
      touch/tablet where right-click is unavailable)
- [x] Text Mode: one global fg/bg pair; whole screen + previews re-render
- [x] Graphics I: picker targets the color group (= charset picker half-row) of the selected character;
      group highlight in the charset picker
- [x] Graphics II: row chips + auto-follow per Decision 2
- [x] All color changes are undoable commands
- **Exit criteria:** each mode's color behavior matches §1 table; renders update everywhere live.

### Phase 7 — Screen Editor
- [x] Canvas grid: 32×24 (8px cells) or 40×24 (6px cells, Text Mode), scaled 1×–8×
- [x] Left-click/drag paints current character; right-click/drag clears (to char 0);
      context-menu suppressed
- [x] Grid overlay toggle
- [x] GMII: each screen third renders from its charset (independent) or the shared set (mirrored)
- [x] Centered toolbar (ordered): share(stub) | scale | grid | rotate L/R · flip H/V · shift L/R/U/D |
      clear all · fill all | undo · redo | screen paginator ‹ 1/n › with add/delete
- [x] Multiple screens per project: add, delete (confirm), paginate; screens named/renameable
- [x] Import/Export button present but stubbed ("coming soon" tooltip) per scope
- **Exit criteria:** draw a full screen with multiple screens, all toolbar ops undoable.

### Phase 8 — Keyboard Shortcuts & Polish
- [x] Shortcut map: Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z redo, Ctrl/Cmd+S save, Esc back,
      `[`/`]` prev/next character, `+`/`-` scale, `G` grid, `F` fill, `C` clear, `I` invert,
      `R`/`Shift+R` rotate, `H`/`V` flip, Alt+arrows shift, `,`/`.` screens, `N` new project
      — documented in README
- [x] Every tooltip shows its shortcut (platform-aware ⌘/⌥/⇧ on Mac); shortcuts disabled
      while typing in inputs/dialogs
- [x] Render tooltips through a popover layer so they never clip at panel edges
- [x] Footer: copyright line + GitHub icon linking to
      https://github.com/acwright/TMS9918-EDITOR (project manager view)
- [x] Save-state indicator (saved / saving / unsaved) in app bar
- [x] Empty states, confirm dialogs, error toasts pass a consistency pass
      (destructive dialogs have explicit Cancel; form dialogs close via X/Esc)
- [x] Addendum: prev/next character buttons restored in the Character panel header
- **Exit criteria:** app fully drivable via documented shortcuts; tooltips accurate.

### Phase 9 — Tablet/Mobile Friendliness
- [x] Responsive layout: below `lg` the two columns become Character / Screen tabs; side by
      side at `lg`+. Screen viewport scrolls/pans when zoomed past the panel.
- [x] Touch drawing (pointer events) for pixel and screen editors; F/B toggle covers missing
      right-click (screen-editor erase-on-touch = paint char 0)
- [x] Hit targets ≥ 40px for toolbar buttons on touch (`pointer-coarse` variant)
- [~] Verified usable on iPad-class viewport (1024×768 and 820×1180) — needs device/emulator
      confirmation by the user; layout + touch wired and unit-tested
- **Exit criteria:** core editing workflows completable on a tablet.

### Phase 10 — README, Screenshot & Release
- [x] README: project description, feature list, screenshot placeholder, TMS9918 background links,
      dev setup (`npm i && npm run dev`), build/deploy instructions, keyboard shortcut table, license note
- [~] Screenshot of the editor with a sample project — needs a browser capture by the user;
      README references `docs/screenshot.png` and samples exist to make one
- [x] Bundled sample project(s) (one per mode) loadable from the project manager (`src/samples/`)
- [~] Final Pages deployment verified; tag `v1.0.0` — needs the user to push to GitHub, verify
      the Pages run, choose a license, and tag
- **Exit criteria:** a newcomer can understand, run, and use the app from the README alone.

---

## 8. Deferred / Future Work

- Import/Export formats (assembly `.byte` dumps of full charset/screens, binary, PNG render) — button exists, implementation deferred
- Multicolor Mode
- Copy/paste characters between slots; charset slot reordering
- Screen cell-region selection, copy/paste, stamp tools
- Optional: shareable URLs, IndexedDB migration if localStorage quota becomes a problem
