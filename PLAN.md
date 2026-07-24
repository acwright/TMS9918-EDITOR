# TMS9918 Character & Screen Editor — Implementation Plan

A multi-phase plan for building a character set and screen editor for the TMS9918 VDP.
This document is the source of truth across agent sessions. **Update the checkboxes and
"Current Status" section as work progresses.**

---

## Current Status

- **Active phase:** Round 5 complete — released as `v1.3.0`: **label case selection** for
  assembly export, a **screen pointer status bar**, and **share links** (compressed project
  in the URL hash). See **§12** for scope, decisions, and Phases 20–23. Round 4 was `v1.2.1`
  (sample refresh); Round 3 was `v1.2.0` (Multicolor Mode); Round 2 was `v1.1.0`;
  Round 1 / Phases 1–10 was `v1.0.0`.
- **Last updated:** 2026-07-24
- **Round 4 (target `v1.2.1`)** is a small patch round replacing the lacklustre Graphics I
  and II samples with proper mock game screens that showcase each mode's colour model — a
  tiled arcade platformer (**Platform Climb**) and a full-bitmap space battle
  (**Star Voyager**). See **§11** for scope and Phase 19.
- **Round 3 (target `v1.2.0`)** kicks off here: a fourth VDP mode — **Multicolor** — with a
  new project type (a 64×48 chunky-pixel colour grid), a stripped-down editor (no character
  or character-set panels; a single-select colour rail + the existing screen canvas/toolbar),
  and multicolor export (synthesised Pattern Generator + fixed Name Table). See **§10** for
  scope, decisions, the mode/export reference, and Phases 15–18.
- **Round 2 (target `v1.1.0`)** delivered: app icon/favicon, a mode-switching &
  paste-to-set character byte box, and the first real **Export** system (screens + character
  sets). See **§9** for scope, decisions, the export-format reference, and Phases 11–14.
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
  art, loadable from the manager's "Load a Sample" row (`store.createFrom`); the Text sample
  uses a full printable-ASCII font in `src/samples/font.ts`. Full README rewrite. Version is
  `1.0.0` (package.json), inlined via Vite `define` (`__APP_VERSION__`) and shown in the
  manager footer; tagged `v1.0.0`. Remaining (need the user): capture `docs/screenshot.png`,
  pick a license, push to GitHub + verify Pages.
- Note: Pages deployment is configured but unverified — the repo has no GitHub remote yet.
  Verify the workflow after the first push (also enable Pages via repo Settings → Pages → Source: GitHub Actions).

---

## 1. Product Summary

A single-page web application for creating and editing TMS9918 character sets and screen
maps. Users manage multiple project files (persisted in browser localStorage, plus
download/upload as JSON), each targeting one of four VDP modes:

| Mode | Screen grid | Cell size | Character sets | Color model |
|---|---|---|---|---|
| Text Mode | 40 × 24 | 6 × 8 px | 1 × 256 chars | One global fg/bg pair |
| Graphics Mode I | 32 × 24 | 8 × 8 px | 1 × 256 chars | fg/bg pair per character-set row (8 chars/group, 32 groups — matches HW color table) |
| Graphics Mode II | 32 × 24 | 8 × 8 px | 1 × 256 mirrored **or** 3 × 256 independent (screen thirds) | fg/bg pair per pixel row of each character (8 pairs/char — matches HW) |
| Multicolor Mode | 64 × 48 | 4 × 4 px | none (no glyph/charset editing) | one solid palette color per 4×4 block; transparent blocks show the backdrop |

Multicolor is unlike the other three: there are **no characters and no character set to
design** — the document is directly a 64×48 grid of palette-colour indices (one solid
colour per chunky block). The Name/Pattern tables the hardware needs are synthesised only
at export time (see **§10**). It is added in Round 3.

Out of scope for now: **Import implementation** (the toolbar Import/Export share button is
replaced by an **Export**-only button in Round 2; Import returns later as its own button).
Export is implemented in Round 2 — see **§9**; extended to Multicolor in Round 3 (**§10**).

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
- **Multicolor:** the screen is a 64×48 matrix of 4×4-pixel blocks (64·4 = 256, 48·4 = 192),
  each block one of the 16 palette entries (0 = transparent → shows the backdrop). There is
  **no colour table and no user-facing character data** — colour comes straight from the
  Pattern Generator nibbles. Hardware layout (synthesised on export, never edited directly):
  - **Name Table** — the fixed 768-byte framebuffer fill `name[r*32 + c] = (r >> 2)*32 + c`
    (r = 0–23 char rows, c = 0–31 char cols), which makes patterns 0–191 tile the screen.
    Identical for every multicolor screen.
  - **Pattern Generator** — 192 patterns × 8 bytes = 1536 bytes. For char cell (c, r) the
    used byte offset within its pattern is `2*(r & 3)`; that byte's high nibble is the
    top-left block and low nibble the top-right, and the next byte is bottom-left/bottom-right
    — i.e. one byte encodes two horizontally-adjacent 4×4 blocks. See §10.3 for the exact
    grid↔byte mapping used by the exporter.

## 5. Data Model (Project File JSON)

```jsonc
{
  "version": 1,
  "id": "uuid",                    // storage key
  "name": "My Project",
  "type": "text" | "graphics1" | "graphics2" | "multicolor",
  "createdAt": "ISO-8601",
  "modifiedAt": "ISO-8601",
  "settings": {
    "g2CharsetMode": "mirrored" | "independent",  // graphics2 only
    "backdrop": 1                                 // multicolor only: palette index behind transparent blocks
  },
  // 1 charset for text/graphics1/mirrored-g2; 3 for independent-g2; [] (empty) for multicolor.
  // Each charset: 256 chars × 8 bytes (pattern rows, MSB = leftmost pixel).
  "charsets": [ [ [0,0,0,0,0,0,0,0], ... ×256 ], ... ],
  "colors": {
    // text:       { "fg": 15, "bg": 4 }
    // graphics1:  { "groups": [ {"fg":15,"bg":1}, ... ×32 ] }        // one per picker row
    // graphics2:  { "rows": [ [ {"fg":15,"bg":1} ×8 ] ×256 ] ×(1|3) }// per char per pixel row, per charset
    // multicolor: {} (empty — colour lives per-cell in `screens[].cells`; backdrop in settings)
  },
  "screens": [
    // text/graphics1/graphics2: cells are charCode ints (0–255), row-major, 768 or 960.
    // multicolor:               cells are palette indices (0–15), row-major, 64×48 = 3072.
    { "name": "Screen 1", "cells": [ /* ints, row-major */ ] }
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
│ chips in GMII]  Color     │  export · scale · grid · rotate ·│
│ picker (2×8, F/B badges)  │  flip · shift · clear · fill ·   │
│ Transform button rows     │  undo · redo · screen paginator  │
│ Byte box ($/# toggle,     ├──────────────────────────────────┤
│ copy + paste-to-set)      │                                  │
│ 3×3 wallpaper preview     │  Screen editor canvas            │
├───────────────────────────┤  (32×24 or 40×24, scrollable,    │
│ Charset picker 8×32       │  1×–8× scale)                    │
│ [charset export button]   │                                  │
│ (scrollable; GMII set     │                                  │
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
- [x] Version bumped to `1.0.0` (shown in the manager footer) and tagged `v1.0.0`
- [~] Final Pages deployment verified — needs the user to push to GitHub, verify the Pages run,
      and choose a license
- **Exit criteria:** a newcomer can understand, run, and use the app from the README alone.

---

## 8. Deferred / Future Work

- **Export formats** — implemented in Round 2 (§9). ~~deferred~~
- **Import** of assembler/BASIC/binary/PNG and **Magellan project files** — its own toolbar
  button, a later round (Round 2 ships Export only). Whole-project JSON import already exists
  in the project manager.
- **Multicolor Mode** — implemented in Round 3 (§10). ~~deferred~~
- Copy/paste characters between slots; charset slot reordering
- Screen cell-region selection, copy/paste, stamp tools
- Optional: shareable URLs, IndexedDB migration if localStorage quota becomes a problem

---

## 9. Round 2 — Improvements (target `v1.1.0`)

Second round of improvements on top of the released `v1.0.0`. Four phases (11–14). Same
conventions as Round 1: all project mutations go through the command layer (undoable),
pure logic lives in `src/domain/` with Vitest specs, chrome stays in the base components.

### 9.1 Scope

1. **App icon / favicon** — a black-and-white, on-theme app icon (Phase 11).
2. **Character byte box** — drop the ca65-specific `.byte`; show the 8 pattern bytes as a
   plain comma-separated **hex** string or **decimal** (BASIC-friendly) string, toggled by a
   button; make the box **paste-to-set** (paste either format to overwrite the character) (Phase 12).
3. **Export system** — the main missing feature. Replace the stubbed screen-toolbar share
   button with an **Export**-only button, and add a **separate Export button for character
   sets**. Support ca65, at least one other assembler dialect, BASIC `DATA`, raw binary, and
   PNG; investigate Magellan interop (Phase 13).
4. **README + release** — document the above, bump to `1.1.0`, tag `v1.1.0`, push (Phase 14).

### 9.2 Confirmed Design Decisions (Round 2)

Settled — the user delegated format/icon judgment ("something of your choosing", "formats you
deem appropriate"). Do not re-litigate without user input:

4. **Icon concept: a monochrome pixel-grid glyph.** On-theme with the 8×8 editor rather than
   a wordmark — a white pixel-art motif on a black rounded tile (a stylized glyph / bitmap
   grid, evoking a character cell). Authored as **SVG** (crisp at every size, trivially
   monochrome) and used as the primary `favicon.svg`; raster fallbacks (`.ico`, a 180×180
   `apple-touch-icon.png`) are generated from it. Black/white only, no palette color.
5. **Byte box is format-agnostic and bidirectional.** Two display radixes — hex
   (`$3C, $42, …`) and decimal (`60, 66, …`, for BASIC) — toggled by one button whose label
   reads **`$`** in hex mode and **`#`** in decimal mode. No assembler directive prefix in
   the box (ca65's `.byte` moves to the Export dialog). The box is editable: on paste/blur it
   parses a tolerant token stream (accepts `$`/`0x`/bare hex or decimal, comma/space/newline
   separators, and strips a leading `.byte`/`db`/`DATA`+line-number); exactly 8 valid bytes
   overwrite the current character via one undoable command, anything else is a no-op with a
   brief inline invalid hint.
6. **Two export scopes, one dialog.** A shared `ExportDialog` opened in **screen** scope
   (from the screen toolbar) or **charset** scope (from the charset picker header). Format
   picker + live preview (for text formats) + Copy and Download actions. The per-character
   byte box (Phase 12) already covers single-character export/import, so the charset button
   targets the *whole* set.
7. **Export is read-only serialization — no schema changes.** Formatters are pure functions
   over the existing `Project`; nothing in `src/domain/types.ts` or stored JSON changes.

### 9.3 Export-format reference

The exportable tables of a TMS9918 project and how each format renders them:

| Table | Source | Text | Graphics I | Graphics II |
|---|---|---|---|---|
| **Pattern** | `charsets[set][char]` | 256×8 bytes | 256×8 bytes | 256×8 bytes per set (1 or 3 sets) |
| **Color** | `colors` | one register nibble `fg<<4\|bg` | 32 bytes (one `fg<<4\|bg` per 8-char group) | 8 bytes/char = 2048 bytes per set (`fg<<4\|bg` per pixel row) |
| **Name** | `screens[n].cells` | 960 bytes (40×24) | 768 bytes (32×24) | 768 bytes (32×24) |

Formats (committed unless marked stretch):

- **ca65 assembler** — `.byte $XX, …`, labelled segments (`char_patterns:`, `char_colors:`,
  `screen_<name>:`). Primary target.
- **Z80 assembler (`db`)** — `db $XX, …` for WLA-DX / sjasmplus / tniasm (MSX, ColecoVision,
  SG-1000 are Z80 — the second most relevant toolchain for this chip). Same table structure,
  different directive/label syntax. One shared assembly builder parameterized by dialect
  (directive, hex prefix, label/comment style).
- **BASIC `DATA`** — decimal bytes as numbered `DATA` lines (configurable start line + step,
  e.g. `1000 DATA 60,66,…`). Targets TI/MSX BASIC.
- **Raw binary** — `.bin` download of the chosen table(s) as a `Uint8Array` (Blob). The
  interchange format most other tools (incl. Magellan) can ingest.
- **PNG** — render a screen (name scope) or a charset sheet (charset scope) to a canvas and
  download. Reuses a shared renderer extracted from `ScreenCanvas.vue`.
- **Magellan interop via binary (no native `.mag`).** Magellan (Daniel Bienvenu's
  ColecoVision/TMS9918 editor) uses a proprietary `.mag` project format with no published spec,
  so a native Magellan export is **out of scope**. Interop is achieved through the **raw binary**
  pattern/color/name tables, which Magellan imports. The README documents this path; no
  Magellan-specific code ships.

### 9.4 Phases

#### Phase 11 — App Icon & Favicon ✅
- [x] Monochrome app icon per Decision 4 — a retro pixel-art "invader" glyph (rounded top,
      two eyes, legs) on a black tile; reads as retro character graphics and stays crisp at
      favicon sizes. Single source bitmap in `scripts/generate-icons.mjs`.
- [x] All assets generated from that one bitmap (zero deps — PNG/ICO encoded via Node `zlib`):
      `public/favicon.svg` (rounded), `favicon.ico` (32×32 PNG-in-ICO), `apple-touch-icon.png`
      (180), `icon-192.png`, `icon-512.png`, plus `public/site.webmanifest` (relative icon
      paths so they resolve under the Pages base; theme/background `#0a0a0a`).
- [x] `index.html`: SVG icon + `.ico` fallback + `apple-touch-icon` + manifest + `theme-color`.
- [x] Verified `VITE_BASE=/TMS9918-EDITOR/ npm run build` copies every asset into `dist/` and
      Vite rebases the `index.html` hrefs to `/TMS9918-EDITOR/…`; type-check green.
- **Exit criteria:** ✅ a distinct black-and-white icon ships in dev and in a Pages-based
  production build. (Rerun `node scripts/generate-icons.mjs` to regenerate from the bitmap.)

#### Phase 12 — Character Byte Box: multi-format + paste-to-set ✅
- [x] New domain `src/domain/bytes.ts`: `formatBytes(bytes, radix)` and `parseBytes(text)`
      (tolerant tokenizer per Decision 5 — infers hex vs decimal, strips `$`/`0x` and a leading
      `.byte`/`db`/`DATA`+line-number, returns 8 in-range bytes or `null`). 13 Vitest specs
      covering both radixes, round-trips, messy paste, and rejections.
- [x] Refactored `Ca65Box.vue` → `CharBytesBox.vue`: `$`/`#` radix toggle, no directive prefix,
      Copy retained, editable field committing on **paste / blur / Enter** via the new undoable
      `editor.setCharPattern(bytes)` (identical-bytes = no-op, so a focus/blur adds no history);
      invalid input flashes a red border + inline hint and reverts. `draft` resyncs from the
      pattern when not being edited (drawing/undo/char-switch keep it current).
- [x] `src/domain/ca65.ts` left intact for Phase 13's export dialog; the byte box no longer
      imports it.
- [x] `CharacterPanel.vue` rewired to `CharBytesBox`; radix is local view state.
- **Exit criteria:** ✅ toggles hex/decimal, copies the shown form, and pasting either form
  (with/without prefixes or line numbers) sets the character with working undo. Full suite
  173 green, type-check + build + lint clean.

#### Phase 13 — Export system (screens + character sets) ✅
- [x] Pure formatters under `src/domain/export/`: `tables.ts` (segment model + `patternTableBytes`
      / `colorTableBytes` (nibble-packed) / `nameTableBytes` + `charsetSegments`/`screenSegments`),
      `assembly.ts` (one builder for ca65 `.byte` & Z80 `db`), `basic.ts` (numbered `REM`/`DATA`,
      start-line + step), `binary.ts` (`Uint8Array` concatenation), barrel `index.ts`. **13 specs**
      cover nibble packing per mode, set-suffix labels, table toggles, and each renderer.
- [x] Shared render + download utils: extracted the draw loop into `src/utils/screenRender.ts`
      (`renderScreen`, `renderCharsetSheet`, `screenToCanvas`/`charsetSheetToCanvas` upscaled with
      smoothing off); `ScreenCanvas.vue` now calls `renderScreen`. Added `src/utils/download.ts`
      (`downloadText` / `downloadBytes` / `downloadCanvasPng` / `downloadBlob`).
- [x] `ExportDialog.vue` (Decision 6): `screen`/`charset` scope; format picker
      (ca65 / Z80 / BASIC / Binary / PNG); scope options (set + Patterns/Colours toggles, or
      Current/All screens; BASIC line start/step); live textarea preview for text, byte-count /
      PNG-dimension summary otherwise; Copy (text) + Download. `AppDialog` gained an optional
      `size` (`md`/`lg`/`xl`) — export uses `xl`.
- [x] Screen toolbar: disabled `Share2` replaced with an **Export Screen** (download icon)
      button → `ExportDialog` scope `screen`. Import stays out (Deferred §8).
- [x] Charset picker header: **Export Character Set** button → `ExportDialog` scope `charset`.
- [ ] Magellan binary-interop note → folded into the Phase 14 README pass (no code).
- **Exit criteria:** ✅ both entry points copy/download ca65, Z80, BASIC, binary, and PNG that
  round-trips the on-screen data; full suite 186 green, type-check + build + lint clean.

#### Phase 14 — README, Versioning & Release ✅
- [x] README: new **Export** section (formats table + entry points + Magellan binary-interop
      note), byte-box hex/decimal + paste bullet, intro/feature-list refresh.
- [x] PLAN Current Status + checkboxes updated.
- [x] Bumped `package.json` to `1.1.0` (surfaces via `__APP_VERSION__` in the manager footer),
      committed, tagged `v1.1.0`, pushed to `origin/main`.
- [x] GitHub release published for `v1.1.0` with a summary of the round.
- **Exit criteria:** ✅ README reflects Round 2; `v1.1.0` tagged, pushed, and released.

---

## 10. Round 3 — Multicolor Mode (target `v1.2.0`)

Third round of improvements on top of `v1.1.0`. Adds a **fourth VDP mode** — Multicolor —
as a first-class project type. Four phases (15–18). Same conventions as before: all project
mutations go through the command layer (undoable), pure logic lives in `src/domain/` with
Vitest specs, chrome stays in the base components.

### 10.1 Scope

1. **New `multicolor` project type** — a 64×48 grid of palette-colour indices (one solid
   colour per 4×4 block; no characters, no charset, no colour table). New-project dialog
   gains a fourth mode with no charset sub-options (Phase 15).
2. **Stripped-down multicolor editor** — reuse the screen canvas + toolbar, but **drop the
   Character panel and Character-Set picker entirely** (they have no meaning here). Add a
   **single-select colour rail** (paint colour + selected-colour readout; left-click paints,
   right-click / secondary erases to transparent). Backdrop colour setting governs how
   transparent blocks render (Phase 16).
3. **Multicolor export** — synthesise the hardware **Pattern Generator** (1536 bytes) from
   the 64×48 grid plus the fixed **Name Table** (768 bytes); wire into the existing
   `ExportDialog` (screen scope only — no charset scope). ca65 / Z80 / BASIC / Binary / PNG
   (Phase 17).
4. **Sample + README + release** — bundle a multicolor sample project, document the mode,
   bump to `1.2.0`, tag `v1.2.0`, push, release (Phase 18).

### 10.2 Confirmed Design Decisions (Round 3)

Settled with the user at Round 3 kickoff. Do not re-litigate without user input:

8. **Multicolor is a distinct project type, not a variant of an existing one.**
   `ProjectType` gains `'multicolor'`. Its screen `cells` are **palette indices (0–15)**, not
   character codes, and its length is 64×48 = **3072**. `charsets` is `[]` (empty) and
   `colors` is `{}` (empty) — colour lives per-cell in the screen. This reuses the existing
   multi-screen support, `Screen` shape, `screenOps` transforms, and autosave/undo machinery
   unchanged. A `MulticolorColors` marker type (empty object) keeps the `ProjectColors` union
   and its narrowing helpers well-formed.
9. **One solid colour per block — single-select colour picker, not fg/bg.** Unlike the other
   three modes, a multicolor block has no foreground/background pair. The colour picker for
   this mode is single-select: one active **paint colour** (selection ring, no F/B badges).
   Left-click/drag paints the paint colour; right-click/drag (and the touch secondary toggle)
   erases to **transparent** (index 0). Reuse `ColorPicker.vue` via a `singleSelect` mode
   rather than forking a new component where practical.
10. **No character or character-set UI in this mode.** The Character panel (pixel editor,
    byte box, wallpaper preview) and the Character-Set picker are **not rendered** for
    multicolor projects. The editor is effectively single-column: colour rail + screen
    panel. Because there is only one panel, the responsive Character/Screen tab split
    (Phase 9) does not apply — the layout is one column at every breakpoint.
11. **Backdrop colour lives in `settings.backdrop`.** Transparent blocks (index 0) render as
    the backdrop (VDP register 7). Default backdrop = `1` (black). A blank multicolor project
    fills all 3072 cells with `0` (transparent) so it opens as a solid backdrop-coloured
    canvas. Editing the backdrop is a small control in the colour rail (undoable command).
12. **Export synthesises hardware tables; the model stays a plain colour grid.** No Name/
    Pattern data is ever stored in the project — the exporter derives the fixed 768-byte Name
    Table and the 1536-byte Pattern Generator from the grid at export time (§10.3). Export is
    read-only serialization, no schema changes beyond the new type/settings above.

### 10.3 Multicolor reference (grid ↔ hardware)

The editable model is a 64×48 array `grid[y][x]` (row-major in `cells`, index `y*64 + x`),
`y` = 0–47 top→bottom, `x` = 0–63 left→right, each value a palette index 0–15.

**Name Table (768 bytes, fixed):** `name[r*32 + c] = (r >> 2) * 32 + c` for char row
`r` = 0–23, char col `c` = 0–31. Constant for every multicolor screen; emitted once.

**Pattern Generator (192 patterns × 8 = 1536 bytes):** char cell (c, r) covers block columns
`2c, 2c+1` and block rows `2r, 2r+1`. Its pattern index is `p = (r >> 2) * 32 + c`; within
that pattern the two bytes it owns are at offset `k = 2 * (r & 3)` and `k + 1`:

```
byte[p*8 + k]   = (grid[2r  ][2c] << 4) | grid[2r  ][2c+1]   // top-left | top-right
byte[p*8 + k+1] = (grid[2r+1][2c] << 4) | grid[2r+1][2c+1]   // bottom-left | bottom-right
```

So one 8-byte pattern encodes a 2-block-wide × 8-block-tall column spanning 4 vertically
stacked char cells; 32 pattern columns × 6 row-groups = 192 patterns cover the whole 64×48.

### 10.4 Multicolor export reference

| Table | Source | Bytes | Notes |
|---|---|---|---|
| **Pattern Generator** | 64×48 `cells` (§10.3) | 1536 per screen | Colour nibbles; label `mc_patterns[_n]`. |
| **Name** | fixed fill (§10.3) | 768 (shared) | Same for all screens; emitted once as `mc_names`. |

- **No colour table** in multicolor — omit the Colours toggle for this scope.
- **ExportDialog** opens in **screen** scope only (screen toolbar). Charset scope is hidden
  because there are no charsets. "Current screen" exports that screen's Pattern Generator +
  the shared Name Table; "All screens" exports each screen's pattern table plus one Name Table.
- **Formats:** ca65 `.byte`, Z80 `db`, BASIC `DATA`, raw Binary, and PNG — all reuse the
  existing renderers over the `ByteSegment` model. PNG renders the 64×48 grid (transparent →
  backdrop) at a selectable scale.

### 10.5 Phases

#### Phase 15 — Multicolor Domain & Data Model ✅
- [x] `types.ts`: added `'multicolor'` to `ProjectType`; added `MulticolorColors`
      (`Record<string, never>` marker) to the `ProjectColors` union + `isMulticolorColors`
      narrowing (`!fg && !groups && !rows`); added `backdrop?: ColorIndex` to `ProjectSettings`.
- [x] `modes.ts`: added the `multicolor` `ModeInfo` (columns 64, rows 48, cellWidth 4,
      cellHeight 4, cellCount 3072); `charsetCount('multicolor')` returns `0`.
- [x] `factory.ts`: blank multicolor project — `charsets: []`, `colors: {}`,
      `settings.backdrop = 1` (black), one screen of 3072 `0`s (transparent).
- [x] New `src/domain/multicolor.ts`: `nameTableBytes()` (fixed 768-byte fill) and
      `patternTableBytes(cells)` (64×48 grid → 1536 bytes) per §10.3, with `MC_*` size/dim
      constants. Standalone (no `modes` import) to avoid a cycle.
- [x] `serialization.ts`: accepts `multicolor`; validates required `backdrop` (0–15), empty
      `charsets` (count 0), empty `colors`, and `cells` length 3072 with values 0–15
      (added `isIntInRange`; screen check now parameterised by mode — 0–15 vs 0–255).
- [x] `colors.ts`/`resolveRowColors` left character-oriented; multicolor never calls it.
- [x] Vitest: factory defaults, mode metadata + `charsetCount 0`, name/pattern synthesis
      (dimensions, packing, per-cell routing, row-group mapping, full grid→tables→decode
      round-trip), and multicolor validation accept/reject cases. Suite **200 green**
      (was 186); type-check + build + lint clean. Also fixed the old serialization spec that
      used `'multicolor'` as its example *unknown* type (now `'graphics3'`).
- **Exit criteria:** ✅ a valid multicolor project can be created, (de)serialized, and its
  hardware tables synthesised, all under test; no UI yet.

#### Phase 16 — Multicolor Editor UI ✅
- [x] `NewProjectDialog`: added **Multicolor Mode** as a fourth mode option (no charset-mode
      sub-choice; the existing `type === 'graphics2'` gate already suppresses it); creating
      one routes to the editor and the factory ignores `g2CharsetMode`.
- [x] `EditorView`: branches on `isMulticolor` → a dedicated single-column `<main>` (slim
      colour rail `aside` + `ScreenPanel`); the non-multicolor `<main>` keeps the Character/
      Charset columns + responsive tabs. Multicolor renders **no** `CharacterPanel`/
      `CharsetPicker` and no tab switcher (Decision 10).
- [x] Colour rail: new `MulticolorPanel.vue` = `ColorPicker.vue` in a new `singleSelect` mode
      (active paint-colour outline ring, no F/B badges/toggle) + a compact **backdrop**
      mini-picker. Editor store gained `paintColor` (view state, `setPaintColor` clamped) and
      `backdrop` (computed from `settings.backdrop`) with an undoable `setBackdrop`.
- [x] `src/utils/screenRender.ts`: `renderScreen` now dispatches to `renderMulticolorScreen`
      (solid 4×4 blocks; transparent → backdrop → neutral); the char-mode path and
      `screenToCanvas` switched from a literal `8` to `cellHeight` (correct for 4px cells).
      `ScreenCanvas.vue` paints a palette index (`brushCode` = `paintColor` in multicolor,
      else `selectedChar`); right-click / touch-secondary erases to transparent (0).
- [x] Toolbar (`ScreenPanel`): unchanged order; the fill button now fills with the paint
      colour in multicolor (label swaps too) via `fillScreen()`; clear-all already sets 0
      (transparent). `paintCell` labels are mode-aware (Paint/Erase Block).
- [x] Touch + responsive: single column at every breakpoint; base components already provide
      the ≥40px `pointer-coarse` targets; `ScreenCanvas` pointer-capture path is shared.
- [x] Vitest: 4 multicolor store specs (paint→grid undo, `setPaintColor` clamp, backdrop
      get/set/undo/dirty, `setBackdrop` no-ops) + a repository regression spec. Suite
      **205 green**; type-check + build + lint clean; every changed SFC transforms cleanly
      through the Vite dev pipeline.
- [x] Fix (found during smoke test): the localStorage index-summary guard
      (`repository.ts` `isSummary`) rejected `'multicolor'`, so saved multicolor projects were
      stripped from the index on read and never showed in the manager. Added `'multicolor'` +
      a regression test. Also dropped the colour-rail help text for consistency with the other
      editors (no per-panel hints elsewhere).
- **Exit criteria:** ✅ create a multicolor project and paint a full 64×48 screen end-to-end
  with working undo/redo, backdrop, grid, transforms, and multiple screens.
  *(Note: verified via the store specs + full production build + a Vite dev-transform smoke of
  every changed module; an in-browser visual pass was not run — no browser driver is installed
  in this environment.)*

#### Phase 17 — Multicolor Export ✅
- [x] `src/domain/export/tables.ts`: new `multicolorScreenSegments` — one Pattern Generator
      per selected screen (`mc_patterns[_n]`, 1536 bytes, `perLine` 8) + one shared Name Table
      (`mc_names`, 768 bytes, `perLine` 32), built on `multicolor.ts` (`patternTableBytes`/
      `nameTableBytes`) and the existing `ByteSegment` model. `screenSegments` dispatches to it
      for `type === 'multicolor'`, so every downstream renderer (asm/BASIC/binary) and the
      dialog work unchanged.
- [x] `ExportDialog.vue`: multicolor reaches only the **screen** scope (there is no charset
      entry point without a `CharsetPicker`, so charset scope + the Colours toggle are
      inherently absent); Current/All screens, formats ca65 / Z80 / BASIC / Binary / PNG all
      apply. Fixed the PNG-dimension summary to use `cellHeight` (was a hardcoded `8`, wrong
      for 4px multicolor cells). PNG renders the 64×48 grid via `renderScreen`'s multicolor
      dispatch (transparent → backdrop).
- [x] Screen toolbar Export button already opens `ExportDialog scope="screen"` — works for
      multicolor with no change.
- [x] Vitest (4 new, suite **209 green**): single-screen segment set + byte lengths + name
      table endpoints (0…191), per-screen label suffixes with a single shared name table,
      nibble packing of a painted block, and the `screenSegments` dispatch. Type-check + build
      + lint clean; changed SFC/module transform cleanly through Vite dev.
- **Exit criteria:** ✅ a multicolor screen exports to ca65, Z80, BASIC, binary, and PNG; the
  synthesised Pattern Generator round-trips the on-screen data (verified by the packing/decode
  specs from Phase 15 + the segment specs here).

#### Phase 18 — Sample, README, Versioning & Release
- [x] Bundled a multicolor **sample project** — `Sample — Vista` in `src/samples/index.ts`
      (`multicolorSample`): a 64×48 chunky scene (two-tone sky, triangular hills, a rimmed sun,
      clouds) plus a full 16-colour palette strip along the bottom. Loadable from the manager's
      "Load a Sample" row; the samples spec validates it (7 green).
- [x] README: Multicolor added to the intro, the modes/features table ("Four VDP modes"), a
      new **Multicolor editor** feature bullet, the Export section (Pattern Generator + shared
      Name Table, screen-only scope, no colour table), and the sample list (Vista).
- [x] PLAN Current Status + checkboxes updated.
- [x] Bumped `package.json` to `1.2.0` (surfaces via `__APP_VERSION__` → manager footer;
      confirmed in the Pages build). Full suite **210 green**; `VITE_BASE` build + lint clean.
- [x] Committed (`25cb2c0`), tagged `v1.2.0`, pushed to `origin/main`, and published the
      GitHub release (<https://github.com/acwright/TMS9918-EDITOR/releases/tag/v1.2.0>).
      Also cleaned up `LICENSE` (standard MIT text + copyright holder) and added
      `.markdownlintignore` so a plain-text file isn't Markdown-linted.
- **Exit criteria:** ✅ README reflects Round 3; the multicolor "Vista" sample ships; `v1.2.0`
  tagged, pushed, and released.

---

## 11. Round 4 — Sample Refresh (target `v1.2.1`)

Fourth round on top of `v1.2.0`: a small patch focused entirely on the bundled sample
projects. The Text and Multicolor samples were already good; the Graphics I ("Landscape")
and Graphics II ("Icons") ones were lacklustre and didn't show off what the modes can do.
Round 4 replaces them with mock game screens drawn from arcade-era inspiration, each chosen
to make the mode's colour model obvious.

### 11.1 Scope

1. **Graphics I → "Platform Climb"** — a tiled arcade platformer (riveted girders, ladders,
   a hero, rolling barrels, a heart prize, and a HUD). Each *tile type* lives in its own
   8-code group with a single fg/bg pair, so the scene reads as flat, per-tile colour — the
   Graphics I colour model at a glance.
2. **Graphics II → "Star Voyager"** — a full-screen 256×192 bitmap space battle (ringed gas
   giant, nebula, starfield, a fighter firing a laser into an enemy). Authored by painting a
   pixel canvas and *fitting* it to the hardware: an **independent** 3-charset layout (256
   unique glyphs per screen third) plus a per-8-pixel-row two-colour quantiser. Showcases the
   near-bitmap, two-colours-per-row model — the opposite of Graphics I's flat tiles.
3. **README + release** — refresh the sample list, bump to `1.2.1`, tag `v1.2.1`, push,
   release. Release title is just the version (`v1.2.1`).

Text ("Text Greeting") and Multicolor ("Vista") samples are unchanged.

### 11.2 Phase 19

#### Phase 19 — Sample Refresh, README & Release
- [x] Rewrote the two weak samples in `src/samples/index.ts`: `platformSample`
      (`platform-climb`) and `spaceSample` (`star-voyager`), replacing `landscapeSample`
      and `iconsSample`. Added canvas-drawing helpers (disc/ring/blit/gradient/text) and a
      two-colour-per-row quantiser (`fitRow` / `fitCanvasToG2`) that fits an arbitrary
      256×192 palette-index canvas onto independent Graphics II. Samples spec still validates
      all four (schema-valid, non-empty, in-bounds codes).
- [x] README sample list updated (Platform Climb + Star Voyager).
- [x] Bumped `package.json` to `1.2.1`; full suite green; lint + build clean.
- [x] Committed, tagged `v1.2.1`, pushed to `origin/main`, GitHub release published.
- **Exit criteria:** ✅ The Graphics I / II samples are proper game screens that demonstrate
  each colour model; README reflects them; `v1.2.1` tagged, pushed, and released.

---

## 12. Round 5 — Export Labels, Pointer Status & Share Links (target `v1.3.0`)

Fifth round on top of `v1.2.1`. Three user-facing features plus the release pass, as
Phases 20–23. Same conventions as every previous round: pure logic lives in `src/domain/`
(or `src/utils/` when it wraps a browser API) with Vitest specs, all project mutations go
through the command layer, chrome stays in the base components.

### 12.1 Scope

1. **Label case selection for assembly export** — the exporter's labels are hard-coded
   snake_case (`char_patterns_1`, `screen_1`, `mc_names`). Add a case picker to the export
   dialog covering snake_case, SCREAMING_SNAKE, camelCase and PascalCase; remember the
   choice across sessions (Phase 20).
2. **Screen pointer status** — a helper line under the screen canvas reporting the pointer's
   cell coordinates plus the mode-relevant facts about the cell under it (Phase 21).
3. **Share links** — a Share action in the project manager that compresses the project JSON
   (gzip via `CompressionStream`) into a base64url URL hash (`#p=…`); opening such a link
   offers to add the project (Phase 22).
4. **README + release** — document all three, bump to `1.3.0`, tag `v1.3.0`, push, release
   with title `v1.3.0` (Phase 23).

### 12.2 Confirmed Design Decisions (Round 5)

Settled with the user at Round 5 kickoff. Do not re-litigate without user input:

13. **Label case is a remembered export preference, defaulting to `snake_case`.**
    Default output is byte-identical to `v1.2.1` so existing exports don't change under
    anyone; the picked case persists in localStorage (`tms9918-editor:prefs`) so a user who
    works in PascalCase sets it once. Case applies to **assembly output only** (ca65 / Z80) —
    BASIC emits `REM` descriptions rather than labels, and binary/PNG have no labels. The
    canonical snake label on `ByteSegment` stays the single source of truth; case is a
    render-time transform (`applyLabelCase`), so no segment builder changes.
14. **Four cases, all valid assembler identifiers.** `snake_case`, `UPPER_SNAKE`
    (ALL CAPS), `camelCase`, `PascalCase`. Kebab/Train case are deliberately absent — a `-`
    is an operator in every supported assembler, so those would emit source that can't
    assemble. Digits stay attached to their token (`char_patterns_1` → `CharPatterns1`).
15. **Pointer status is a read-only status line, not a store concern.** `ScreenCanvas` emits
    the hovered cell (`hover` event, `null` on leave/stroke end); `ScreenPanel` renders the
    line. The formatting is a pure function (`src/domain/screenStatus.ts`) so it is unit
    tested per mode. Fixed height and tabular figures so the toolbar/canvas never shift as
    values change.
16. **Status content is mode-aware.** Always: cell/block column & row and the cell's top-left
    pixel coordinate. Text/Graphics I/II add the character code under the pointer in hex and
    decimal; Graphics I adds its colour group (0–31); Graphics II adds the screen third
    (= charset 1–3 when independent); Multicolor reports the palette index and colour name.
    With no pointer over the canvas the line shows the screen's dimensions instead of blanks.
17. **Share links carry the whole project, compressed, in the URL hash.**
    `#p=<scheme><base64url>` where scheme `1` = gzip (`CompressionStream`) and `0` = plain —
    the fallback keeps the feature working on any browser without the Compression Streams
    API and makes the payload self-describing. Compact (not pretty) JSON is compressed. The
    hash never touches a server (fragments aren't sent), so no backend is involved.
18. **A share link is an offer, not an action.** Opening one lands on the project manager and
    raises a dialog naming the project (name · mode · screen count) with **Add & Open** /
    **Discard**. The hash is stripped at startup (`history.replaceState`) so a reload doesn't
    re-prompt; a corrupt or truncated payload surfaces in the manager's existing error banner.
    Import reuses `store.importProject`, which already assigns a fresh id on collision.
19. **Share lives in the project-manager row only** (alongside download/duplicate/delete) —
    not in the editor app bar or the screen toolbar. A link is always the *whole project*, so
    the per-project row is the honest place for it; the screen toolbar's Export button stays
    screen-scoped. The dialog shows the link, a Copy button, its length, and a warning when
    it grows past the point where chat apps and unfurlers start truncating.

### 12.3 Label case reference

`ByteSegment.label` stays canonical snake_case; `applyLabelCase(label, case)` splits on `_`
and rejoins:

| Case id | Example (`char_patterns_1`) | Example (`mc_names`) |
|---|---|---|
| `snake` (default) | `char_patterns_1` | `mc_names` |
| `upper` | `CHAR_PATTERNS_1` | `MC_NAMES` |
| `camel` | `charPatterns1` | `mcNames` |
| `pascal` | `CharPatterns1` | `McNames` |

### 12.4 Share link reference

```
https://acwright.github.io/TMS9918-EDITOR/#p=1H4sIA…
                                            ^ scheme: 1 = gzip, 0 = plain
```

- **Encode:** `JSON.stringify(project)` (compact) → UTF-8 bytes → `CompressionStream('gzip')`
  → base64url (`+/=` → `-_`, padding stripped).
- **Decode:** base64url → bytes → `DecompressionStream('gzip')` → UTF-8 →
  `deserializeProject` (the existing validator, so a mangled link fails with the same
  human-readable errors as a bad file upload).
- **Size expectation:** Text / single-screen Graphics I projects land well under 2 KB of URL.
  A maxed Graphics II project (3 charsets + per-row colour table + several screens) is the
  worst case — tens to 100+ KB of JSON, but gzip crushes the repetition to single-digit KB.
  Browsers handle megabyte hashes; the practical limit is link unfurlers, so the dialog warns
  above **2,000 characters** and points at Download JSON for the big ones.

### 12.5 Phases

#### Phase 20 — Assembly Label Case ✅
- [x] `src/domain/export/labels.ts`: `LabelCase`, `LABEL_CASES` (id + UI label + example),
      `isLabelCase` and `applyLabelCase(label, case)` per §12.3 — a token split on `_` and
      rejoin, so digits stay attached (`char_patterns_1` → `CharPatterns1`).
- [x] `segmentsToAsm(segments, dialect, title, options?)` takes `AsmOptions { labelCase }`,
      defaulting to `snake` — existing callers and specs are untouched.
- [x] `src/persistence/preferences.ts`: localStorage-backed preferences record
      (`tms9918-editor:prefs`) with `loadPreferences`/`savePreferences`; unreadable, corrupt,
      throwing, or unavailable storage all fall back to defaults rather than breaking export.
- [x] `ExportDialog.vue`: a **Labels** fieldset (existing segmented-button styling, monospace,
      each button titled with its example) shown only for the ca65/Z80 formats; the live
      preview reflects it and the choice is written on click.
- [x] Vitest (**13 new**, suite 223 green): all four cases, single-token and `mc_names`
      handling, an identifier-shape assertion for every case, the asm renderer honouring the
      option, default-output equality, and preference round-trip/merge/corruption/throwing-store.
- **Exit criteria:** ✅ ca65/Z80 export emits labels in the chosen case, default output is
  byte-identical to `v1.2.1`, and the choice survives a reload.

#### Phase 21 — Screen Pointer Status ✅
- [x] `src/domain/screenStatus.ts`: `screenStatus(project, screen, cell | null)` → `{ active,
      coords, pixel, details }` per Decision 16, plus `formatScreenStatus` for the one-line
      rendering. Pure, no Vue. Out-of-bounds cells fall back to the idle form.
- [x] `ScreenCanvas.vue`: emits `hover` (cell or `null`) from the existing pointer math, on
      move as well as during a stroke; cleared on `pointerleave` and — for touch/pen, which
      leave no pointer behind — at stroke end.
- [x] `ScreenPanel.vue`: renders the status line under the canvas viewport (monospace,
      tabular figures, fixed `h-4` so nothing shifts; dimmed in the idle state).
- [x] Vitest (**8 new**, suite 231 green): idle form per mode, coordinates + pixel origin
      (incl. Text Mode's 6px cells), Graphics I colour group, Graphics II third vs. set,
      multicolor palette index + colour name, out-of-bounds, and the formatted line.
- **Exit criteria:** ✅ moving the pointer over any mode's screen reports live coordinates and
  the cell's mode-relevant data; the fixed-height line keeps the layout still.

#### Phase 22 — Share Links ✅
- [x] `src/domain/share.ts`: `encodeShare`/`decodeShare` per §12.4 (chunked base64url,
      gzip through a `pump` helper over Compression Streams with the `0` plain-scheme
      fallback, `ShareLinkError` for damaged payloads, `deserializeProject` for schema
      errors), plus `shareUrl`, `readShareHash`, `capturePendingShare`, `takePendingShare`.
      The writer-side rejection on a corrupt payload is swallowed so only the reader's
      error is reported (an unhandled rejection otherwise).
- [x] Startup capture in `App.vue`: reads `#p=` once, strips the hash via
      `history.replaceState`, and routes to `/` when the link landed on another route.
- [x] `src/components/projects/ShareDialog.vue`: rebuilds the link whenever it opens,
      readonly select-on-focus field, Copy with a check-mark confirmation, character count,
      and the >2,000-character truncation warning.
- [x] Shared-link flow in `ProjectManagerView.vue`: decodes the pending payload on mount and
      raises a **Shared Project** dialog (name · mode · screen count) with **Add & Open** /
      **Discard**; decode failures go to the existing error banner.
- [x] **Share Link** button in each project row (between Duplicate and Download). Store gained
      `shareLink(id)` (load → encode → URL) and `adopt(project)` — the collision-safe tail
      extracted from `importProject`, now shared by uploads and share links.
- [x] Vitest (**14 new**, suite 245 green): round-trip per mode, a heavy Graphics II project
      compressing past 10× and re-decoding, hash parsing/URL shape, rejection of missing,
      unknown-scheme and truncated payloads, the plain-scheme path, schema errors surfacing
      as `ProjectValidationError`, plus store specs for `shareLink` and `adopt`.
- **Exit criteria:** ✅ a link decodes back to an identical project and is offered for adoption
  with one confirmation; a mangled link fails with a clear message instead of a blank app.
  *(Verified via the domain/store specs, a production build, and a Vite dev-transform smoke of
  every changed module; no in-browser pass — no browser driver in this environment.)*

#### Phase 23 — README, Versioning & Release ✅
- [x] README: **Labels** paragraph in the Export section, a new **Sharing** section, pointer
      status and share links in the feature list, intro refreshed.
- [x] PLAN Current Status + checkboxes updated.
- [x] Bumped `package.json` to `1.3.0` (surfaces via `__APP_VERSION__` → manager footer);
      suite **245 green**, type-check + lint + `VITE_BASE=/TMS9918-EDITOR/` build clean.
- [x] Committed, tagged `v1.3.0`, pushed to `origin/main`, GitHub release published with the
      title `v1.3.0`.
- **Exit criteria:** ✅ README reflects Round 5; `v1.3.0` tagged, pushed, and released.
