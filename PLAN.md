# TMS9918 Character & Screen Editor — Implementation Plan

A multi-phase plan for building a character set and screen editor for the TMS9918 VDP.
This document is the source of truth across agent sessions. **Update the checkboxes and
"Current Status" section as work progresses.**

---

## Current Status

- **Active phase:** Round 7 complete — released as `v1.4.0`: a **Sprite editor mode**, a fifth
  project type whose pattern table *is* the hardware Sprite Pattern Table, with an 8×8 / 16×16
  sprite editor, per-sprite colour, named frame **animations** with a live preview, and sprite
  export. See **§14** and Phases 25–29.
- **Post-release fixes** (on `main`, suite 409 green — see §14.9):
  the sample grid orphaned its fifth card, and `ShareDialog` threw a temporal-dead-zone
  `ReferenceError` on every manager visit.
- Round 6 was `v1.3.1` (project manager layout, **§13** / Phase 24); Round 5 was `v1.3.0`
  (label case, pointer status, share links); Round 4 was `v1.2.1` (sample refresh); Round 3
  was `v1.2.0` (Multicolor Mode); Round 2 was `v1.1.0`; Round 1 / Phases 1–10 was `v1.0.0`.
- **Last updated:** 2026-07-25
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
download/upload as JSON), each targeting one of five VDP document types:

| Mode | Screen grid | Cell size | Character sets | Color model |
|---|---|---|---|---|
| Text Mode | 40 × 24 | 6 × 8 px | 1 × 256 chars | One global fg/bg pair |
| Graphics Mode I | 32 × 24 | 8 × 8 px | 1 × 256 chars | fg/bg pair per character-set row (8 chars/group, 32 groups — matches HW color table) |
| Graphics Mode II | 32 × 24 | 8 × 8 px | 1 × 256 mirrored **or** 3 × 256 independent (screen thirds) | fg/bg pair per pixel row of each character (8 pairs/char — matches HW) |
| Multicolor Mode | 64 × 48 | 4 × 4 px | none (no glyph/charset editing) | one solid palette color per 4×4 block; transparent blocks show the backdrop |
| Sprite Mode | none (not a screen mode) | 8 × 8 or 16 × 16 px sprites | 1 × 256 patterns = the 2 KB Sprite Pattern Table | one solid palette color per sprite (0 = invisible) |

Multicolor is unlike the first three: there are **no characters and no character set to
design** — the document is directly a 64×48 grid of palette-colour indices (one solid
colour per chunky block). The Name/Pattern tables the hardware needs are synthesised only
at export time (see **§10**). It is added in Round 3.

Sprite Mode is unlike all four: it has **no screen at all**. The document is the sprite
pattern table plus a per-sprite colour and a set of named **animations** (ordered lists of
sprite frames) used for a live preview. Sprites are a hardware layer that overlays *any*
graphics mode, so a sprite project is a companion to a screen project rather than a variant
of one. It is added in Round 7 (see **§14**).

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
- **Sprites:** an independent hardware layer available in Graphics I, Graphics II and
  Multicolor (**not** in Text Mode). 32 sprites, one solid colour each, driven by a
  256-entry × 8-byte **Sprite Pattern Table** and a 32-entry × 4-byte **Sprite Attribute
  Table**. Sprite size (8×8 / 16×16) and magnification (1× / 2×) are global register bits.
  Full reference in **§14.3**.

## 5. Data Model (Project File JSON)

```jsonc
{
  "version": 1,
  "id": "uuid",                    // storage key
  "name": "My Project",
  "type": "text" | "graphics1" | "graphics2" | "multicolor" | "sprite",
  "createdAt": "ISO-8601",
  "modifiedAt": "ISO-8601",
  "settings": {
    "g2CharsetMode": "mirrored" | "independent",  // graphics2 only
    "backdrop": 1,                                // multicolor + sprite: palette index behind transparent pixels
    "spriteSize": 8 | 16,                         // sprite only: VDP R1 SIZE bit
    "spriteMag": 1 | 2                            // sprite only: VDP R1 MAG bit
  },
  // 1 charset for text/graphics1/mirrored-g2/sprite; 3 for independent-g2; [] for multicolor.
  // Each charset: 256 chars × 8 bytes (pattern rows, MSB = leftmost pixel).
  // For sprite projects this single table *is* the 2048-byte Sprite Pattern Table.
  "charsets": [ [ [0,0,0,0,0,0,0,0], ... ×256 ], ... ],
  "colors": {
    // text:       { "fg": 15, "bg": 4 }
    // graphics1:  { "groups": [ {"fg":15,"bg":1}, ... ×32 ] }        // one per picker row
    // graphics2:  { "rows": [ [ {"fg":15,"bg":1} ×8 ] ×256 ] ×(1|3) }// per char per pixel row, per charset
    // multicolor: {} (empty — colour lives per-cell in `screens[].cells`; backdrop in settings)
    // sprite:     { "sprites": [ 15, ... ×256 ] }                    // one palette index per pattern slot
  },
  "screens": [
    // text/graphics1/graphics2: cells are charCode ints (0–255), row-major, 768 or 960.
    // multicolor:               cells are palette indices (0–15), row-major, 64×48 = 3072.
    // sprite:                   [] (empty — sprite projects have no screen)
    { "name": "Screen 1", "cells": [ /* ints, row-major */ ] }
  ],
  // Sprite projects only; absent for every other type (§14.4).
  "animations": [
    { "name": "Walk", "frames": [0, 1, 2, 1], "fps": 8 }  // frames are sprite *slot* indices
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
- **Sprite Mode** — implemented in Round 7 (§14). ~~deferred~~
- **Sprite layouts / Sprite Attribute Table with positions** — Round 7 exports pattern,
  colour and animation frame data but no X/Y placement, so it emits no SAT. A later round
  could add a "sprite layout" document (up to 32 sprites positioned on a 256×192 stage,
  with a live 4-sprites-per-scanline warning) that exports a real 128-byte SAT.
- **Multi-sprite layering** — the classic TMS9918 trick of stacking two or three
  single-colour sprites to fake a multi-colour one. Needs the layout concept above plus a
  composite preview; deliberately out of Round 7.
- **Sprite frames over a screen** — previewing an animation on top of a Graphics I/II
  screen from another project (cross-project reference). Out of scope while a project is
  the unit of storage.
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

---

## 13. Round 6 — Project Manager Layout (target `v1.3.1`)

A small patch round on top of `v1.3.0`. Round 5 added a fifth action (**Share Link**) to
every project row, and at `max-w-3xl` the row ran out of horizontal room: project names
truncated mid-word while the page sat in a narrow column with empty space either side.
One phase (24), presentation only — no domain, store, or persistence changes.

### 13.1 Scope

- Widen the manager page so the list uses the space that is already there.
- Give the row a structure that degrades cleanly instead of squeezing the name.
- Keep the sample grid balanced at the new width.

### 13.2 Decisions

- **Decision 19 — `max-w-5xl` for the manager.** The editor is already full-bleed; only the
  manager was constrained. 5xl (1024px) is wide enough for a long name plus the mode badge,
  timestamp, and five actions, and still reads as a centred document rather than a stretched
  table on a 4K display.
- **Decision 20 — the timestamp leaves the name button.** It was the third item inside the
  clickable open-project button, competing with the name for width via `ml-auto`. As its own
  sibling it can shrink or wrap without ever forcing the name to truncate, and the button's
  hit area still spans everything left of it.
- **Decision 21 — the row wraps rather than compresses.** Below `sm` the name takes a full
  line and the timestamp + action cluster share the line beneath it (timestamp left, actions
  right). Above `sm` it is a single line, as before. This keeps the five coarse-pointer
  targets at full size on a phone instead of shrinking them.
- **Decision 22 — samples go 4-up.** `sm:grid-cols-2 lg:grid-cols-4` — with four samples,
  the old `sm:grid-cols-3` left one card orphaned on its own row at the new width.

### 13.3 Phases

#### Phase 24 — Manager Layout & Release ✅
- [x] `ProjectManagerView.vue`: page container `max-w-3xl` → `max-w-5xl` (Decision 19).
- [x] Timestamp moved out of the open-project button, given `tabular-nums` so the rows'
      dates align and `truncate` so it yields before the layout does (Decision 20).
- [x] Row is `flex-wrap` with the name button `basis-full sm:basis-0`; the timestamp and
      action cluster share a wrapper that is a full line below `sm` and shrink-to-fit above
      it (Decision 21).
- [x] Sample grid `sm:grid-cols-2 lg:grid-cols-4` (Decision 22).
- [x] README: new **Project manager** feature bullet.
- [x] Bumped `package.json` to `1.3.1` (surfaces via `__APP_VERSION__` → manager footer);
      suite **245 green**, type-check + lint + `VITE_BASE=/TMS9918-EDITOR/` build clean.
- [x] Committed, tagged `v1.3.1`, pushed to `origin/main`, GitHub release published with the
      title `v1.3.1`.
- **Exit criteria:** ✅ project names no longer truncate at desktop widths, the five row
  actions sit at full size on a phone without overflowing, and `v1.3.1` is tagged, pushed,
  and released. *(Layout verified by reading the emitted classes and a production build;
  no in-browser pass — no browser driver in this environment.)*

---

## 14. Round 7 — Sprite Editor Mode (target `v1.4.0`)

Seventh round, on top of `v1.3.1`. Adds a **fifth project type — Sprite** — covering the
one part of the TMS9918 the editor has never touched: the sprite layer. Five phases (25–29).
Same conventions as every previous round: pure logic lives in `src/domain/` with Vitest
specs, every project mutation goes through the command layer (undoable), chrome stays in
the base components, and the round ends with README + version bump + tag + push + GitHub
release.

Sprites are a hardware overlay that works in Graphics I, Graphics II and Multicolor (never
in Text Mode), so a sprite project is a **companion document** to a screen project, not a
variant of one. That framing drives most of the decisions below: a sprite project has no
screen, and its deliverable is the sprite pattern/colour/animation data an assembler needs.

### 14.1 Scope

1. **New `sprite` project type** — one 256×8 pattern table (byte-identical in shape to the
   hardware 2048-byte Sprite Pattern Table), one palette colour per sprite, project-wide
   size (8×8 / 16×16) and magnification (1× / 2×) settings, no screens, plus a new
   `animations` array (Phase 25).
2. **Targeted sprite editor UI** — an 8×8 *or* 16×16 pixel editor (16×16 composited from
   four hardware quadrants), a sprite picker showing every slot in its own colour over a
   transparency checkerboard, a single-select colour rail + backdrop, a size-aware byte box,
   and the existing transform buttons operating on the whole sprite (Phase 26).
3. **Animations & live preview** — named animations (ordered lists of sprite slots) with a
   frame strip, fps control, play/pause/scrub, and a preview canvas that honours
   magnification and the backdrop colour. This is the "does my walk cycle read?" feedback
   loop that a static grid can't give (Phase 27).
4. **Sprite export** — Sprite Pattern Table, a per-sprite colour byte table (drop-in for
   Sprite Attribute Table byte 4), and one frame table per animation, through the existing
   `ExportDialog` (ca65 / Z80 / BASIC / Binary / PNG) (Phase 28).
5. **Sample + README + release** — bundle a sprite sample with real animations, document the
   mode, bump to `1.4.0`, tag `v1.4.0`, push, release with the title `v1.4.0` (Phase 29).

### 14.2 Confirmed Design Decisions (Round 7)

Settled at Round 7 kickoff; the user delegated the hardware/format judgment ("my
understanding of the sprite specifications is minimal so I will lean on your research").
Do not re-litigate without user input.

23. **Sprite is a fifth project type, and its charset *is* the Sprite Pattern Table.**
    `ProjectType` gains `'sprite'`. `charsets` holds exactly one 256×8-byte table, which is
    bit-for-bit the hardware's 2048-byte Sprite Pattern Table (§14.3) — the same shape the
    editor has stored since Phase 2. That reuse is the whole reason this mode is cheap:
    `charOps`, `CharBytesBox`, `patternTableBytes`, charset validation, undo, autosave and
    share links all work unchanged. `charsetCount('sprite')` returns `1`.
24. **Size and magnification are project settings, mirroring VDP register 1.**
    `settings.spriteSize: 8 | 16` and `settings.spriteMag: 1 | 2`. Both are *global* register
    bits on real hardware — every sprite on screen shares them — so they belong to the
    project, not to individual sprites. Size is chosen at creation and **convertible later**
    from the project settings dialog: it only changes how the 256 patterns are *grouped*, so
    no pattern bytes are ever lost in either direction (unlike Decision 1's GMII conversion,
    this needs no destructive warning). Magnification is display-only.
25. **A "sprite" is a slot, not a pattern.** At 8×8 there are 256 slots and slot *n* = pattern
    *n*. At 16×16 there are 64 slots and slot *n* = patterns `4n … 4n+3` (the hardware ignores
    the low two bits of a pattern name in 16×16 mode). One shared slot vocabulary —
    `spriteCount(size)`, `slotToPattern(slot, size)`, `patternToSlot(pattern, size)` — indexes
    the picker, the pixel editor, the colour table, animation frames and the exporter
    identically, so nothing downstream has to special-case size.
26. **16×16 pixels map through the hardware quadrant order.** Top-left, **bottom-left**,
    top-right, bottom-right (§14.3) — the counter-intuitive column-major order is the single
    most common bug in TMS9918 sprite code. It is confined to pure `spriteOps` functions
    (`spriteGrid` / `writeSpritePixel` / `gridToPatterns`) so no component ever computes it,
    and it gets a dedicated round-trip spec.
27. **One colour per sprite slot, single-select.** `colors: { sprites: ColorIndex[] }` — 256
    entries, one per pattern slot, default 15 (white). At 16×16 the quad-base entry
    (`sprites[4n]`) governs the sprite; the other three are unreachable while that size is
    active. **Amended after Phase 26 smoke testing** — see Decision 34: splitting back to
    8×8 now spreads the quad's colour to those three entries. The colour rail reuses
    `ColorPicker`'s `singleSelect`
    mode from Round 3 (Decision 9) — a sprite has no fg/bg pair. Colour 0 is legal and means
    *invisible*; the picker flags a colour-0 sprite rather than silently showing nothing.
    **Note:** `isMulticolorColors` currently narrows on the *absence* of `fg`/`groups`/`rows`,
    so a `sprites` key would wrongly narrow as multicolor — it must gain a `sprites` exclusion
    at the same time `isSpriteColors` is added.
28. **A sprite project has no screen.** `screens: []`, and `validateScreens` requires exactly
    zero screens for `sprite` (it currently requires at least one for every type). Sprites are
    an overlay over *someone else's* screen; inventing a stage to place them on would be a
    different feature (see §8, deferred). `MODES.sprite` therefore carries
    `columns/rows/cellCount = 0`, and `ModeInfo` gains an explicit **`hasScreen: boolean`** so
    every consumer gates on a named flag instead of testing `cellCount === 0`.
29. **Animations are a first-class, optional top-level array — not repurposed screens.**
    `animations?: SpriteAnimation[]`, present only for sprite projects. A screen is a
    fixed-length grid of cells; an animation is a variable-length ordered list of slot
    references. Overloading `screens[].cells` would break the length invariant every
    validator, transform and exporter relies on, in exchange for reusing a paginator that is
    ~30 lines. The `AnimationPanel` gets its own paginator modelled on the screen one.
30. **The schema stays `version: 1`.** `animations` is additive and optional, and no existing
    field changes meaning, so files written by `v1.3.1` remain valid. A `v1.3.1` app opening a
    sprite project still fails — but on `type`, with the existing clear message, which is the
    correct outcome.
31. **The preview animates one sprite over a backdrop.** Reuses `settings.backdrop` (added in
    Round 3, Decision 11) so transparent pixels resolve the same way they do in multicolor.
    Play/pause, fps 1–30, frame scrub, honours `spriteMag`, plus an independent view zoom
    (1×–8×) that is view state — never in the undo stack, never persisted to the file. The
    rAF loop lives in the component and stops on unmount, on pause, and when the animation has
    fewer than two frames.
32. **Export is the deliverable; positions are not.** Three segment kinds (§14.6): the Sprite
    Pattern Table, a **sprite colour table** (one byte per slot, low nibble = colour, EC bit
    clear — drop it straight into Sprite Attribute Table byte 4), and one **frame table** per
    animation holding the SAT pattern-name byte for each frame (`slot * 4` at 16×16, `slot` at
    8×8), so the emitted bytes are usable without further arithmetic. No Sprite Attribute
    Table is emitted, because the editor has no X/Y data to put in one — that is the deferred
    "sprite layout" feature in §8. `ExportDialog` gains a `sprite` scope.
33. **Hardware limits are documented, not enforced.** 32 sprites on screen, 4 per scanline,
    the 5th-sprite drop, priority by index, the 0xD0 terminator and the early-clock bit are
    all facts about *placement*, which this mode doesn't model. They go in §14.3, the README,
    and a short "Hardware notes" block in the sprite settings dialog — the editor never
    blocks an edit over them.
34. **A 16×16 → 8×8 split spreads the quad's colour to all four patterns.**
    *Added during Phase 26 after a smoke test; amends Decision 27.* Colouring an 8×8 sprite
    green, grouping to 16×16, drawing the other three quadrants, then splitting back left
    three of the four sprites white — their 8×8 entries had never been set, because at 16×16
    only the quad base is reachable. Decision 27 called that "lossless", and technically it
    was: it preserved colours the user had never chosen while discarding the one they had
    just been looking at. On a 16→8 split each entry now takes its quad base's colour
    (`sprites[i] ← sprites[i - (i % 4)]`), so the four new sprites keep what the 16×16 sprite
    was showing. Growing 8→16 still changes nothing. This *is* mildly lossy in one case —
    four distinct 8×8 colours within one quad collapse after an 8→16→8 round trip — but it is
    a single undoable command, the dialog says so, and the alternative silently discards the
    colour actually on screen. Pattern bytes are untouched in both directions.

### 14.3 Sprite hardware reference

Verified against the TI *TMS9918A/TMS9928A/TMS9929A Video Display Processors Data Manual*
and Thierry Nouspikel's VDP write-up (see Sources in the README).

**Sprite Pattern Table** — 256 patterns × 8 bytes = **2048 bytes**. One bit per pixel,
MSB = leftmost, exactly like the character Pattern Generator. Monochrome: a set bit paints
the sprite's colour, a clear bit is transparent.

**Sizes** — VDP register 1 carries two bits (TI numbers bits MSB-first, so these are its
bits 6 and 7; in LSB-0 terms bit 1 and bit 0):

| SIZE | MAG | Sprite pattern | Pixels on screen | Slots available |
|---|---|---|---|---|
| 0 | 0 | 8 × 8 (1 pattern) | 8 × 8 | 256 |
| 0 | 1 | 8 × 8 (1 pattern) | 16 × 16 (each pixel a 2×2 box) | 256 |
| 1 | 0 | 16 × 16 (4 patterns) | 16 × 16 | 64 |
| 1 | 1 | 16 × 16 (4 patterns) | 32 × 32 (each pixel a 2×2 box) | 64 |

**16×16 quadrant order** — a 16×16 sprite uses four consecutive patterns starting at a
multiple of 4 (the hardware masks off the low two bits of the pattern name). The four 8-byte
groups are laid out **column-major**:

```
pattern 4n     → top-left      bytes  0– 7      ┌───────┬───────┐
pattern 4n + 1 → bottom-left   bytes  8–15      │ 4n    │ 4n+2  │
pattern 4n + 2 → top-right     bytes 16–23      ├───────┼───────┤
pattern 4n + 3 → bottom-right  bytes 24–31      │ 4n+1  │ 4n+3  │
                                                └───────┴───────┘
```

So for sprite-local pixel `(x, y)`, `0 ≤ x,y < 16`:
`pattern = 4n + (x >> 3) * 2 + (y >> 3)`, `byteIndex = y & 7`, `bitMask = 0x80 >> (x & 7)`.

**Sprite Attribute Table** — 32 entries × 4 bytes = **128 bytes** (not produced by this
round; documented so the exported colour/pattern bytes make sense):

| Byte | Contents |
|---|---|
| 0 | Vertical position. Offset by one: `0xFF` is the **topmost** pixel line, `0x00` the second, `0xBE` the last. `0xD0` (208) is a **terminator** — that sprite and every later one is not displayed. |
| 1 | Horizontal position, 0–255 (left edge). |
| 2 | Pattern name. In 16×16 mode the low two bits are ignored, so usable names are multiples of 4. |
| 3 | Bit 7 = **early clock** (shifts the sprite 32 pixels *left*, letting it enter from the left edge); bits 3–0 = palette colour. Bits 6–4 are unused. |

**Limits and behaviour**

- 32 sprites total; only **4 per horizontal scan line** — the 5th and beyond are dropped on
  that line and its number is reported in the status register.
- Priority is by index: sprite 0 draws over sprite 1, and so on. Sprites always overlay the
  background pattern layer.
- Colour 0 is transparent — the sprite is invisible but still consumes one of the four
  per-line slots and still sets the coincidence flag.
- Sprites do **not** exist in Text Mode. They are available in Graphics I, Graphics II and
  Multicolor.

### 14.4 Data model additions

```ts
// types.ts
export type ProjectType = 'text' | 'graphics1' | 'graphics2' | 'multicolor' | 'sprite'

/** Sprite: one solid palette colour per pattern slot (256 entries; 16×16 uses sprites[4n]). */
export interface SpriteColors {
  sprites: ColorIndex[]
}

/** An ordered list of sprite slots played back as a preview (§14.2 Decision 29). */
export interface SpriteAnimation {
  name: string
  /** Sprite *slot* indices (0–255 at 8×8, 0–63 at 16×16). May repeat; may be empty. */
  frames: number[]
  /** Playback rate, 1–30. */
  fps: number
}

export interface ProjectSettings {
  g2CharsetMode?: G2CharsetMode
  backdrop?: ColorIndex     // multicolor + sprite
  spriteSize?: 8 | 16       // sprite only
  spriteMag?: 1 | 2         // sprite only
}

export interface Project {
  /* …unchanged… */
  animations?: SpriteAnimation[]   // sprite only
}
```

Blank sprite project (factory): one blank 256×8 charset, `colors.sprites` = 256 × `15`,
`settings` = `{ spriteSize: 8, spriteMag: 1, backdrop: 1 }`, `screens: []`, and one starter
animation `{ name: 'Animation 1', frames: [0], fps: 8 }`.

### 14.5 Editor UI layout (sprite mode)

A third `EditorView` branch, alongside the existing character branch and the multicolor
branch. Two columns at `lg`+, Sprite / Animation tabs below it (the same pattern as the
character modes; multicolor's single-column exception does not apply).

```
┌──────────────────────────────────────────────────────────────┐
│ App bar: project name · SPRITE MODE · save state · back      │
├───────────────────────────┬──────────────────────────────────┤
│ Sprite editor 8×8 / 16×16 │  Animation toolbar:              │
│ (quadrant guides at 16×16)│  export · zoom · play/pause ·    │
│ Colour rail (single-      │  undo · redo ·                   │
│ select) + backdrop        │  animation paginator ‹ 1/n ›     │
│ Transform button rows     ├──────────────────────────────────┤
│ Byte box (8 or 32 bytes,  │  Preview canvas                  │
│ $/# toggle, paste-to-set) │  (backdrop, honours MAG, 1×–8×)  │
├───────────────────────────┤                                  │
│ Sprite picker             │  Frame strip:                    │
│ 16×16 slots (8×8 sprites) │  [0][1][2][1] + add/remove/move  │
│ 8×8 slots (16×16 sprites) │  fps stepper · frame count       │
│ [sprite export button]    │                                  │
└───────────────────────────┴──────────────────────────────────┘
```

Shortcut deltas for this mode (documented in the README alongside the existing map):
`[` / `]` previous/next **sprite slot**, `,` / `.` previous/next **animation**,
`Space` play/pause, `+` / `-` preview zoom. The screen-only bindings (`G` grid) are inert
here; every character transform key (`F`, `C`, `I`, `R`, `H`, `V`, Alt+arrows) applies to
the whole sprite, 8×8 or 16×16.

### 14.6 Sprite export reference

| Segment | Label | Bytes | Contents |
|---|---|---|---|
| **Sprite patterns** | `sprite_patterns` | 2048 | The whole pattern table, 8 bytes per line. In 16×16 mode the bytes are already in hardware quadrant order, so no reordering happens at export. |
| **Sprite colours** | `sprite_colors` | 256 (8×8) / 64 (16×16) | One byte per slot: `colour & 0x0F`, early-clock bit clear. Drop-in for Sprite Attribute Table byte 4. |
| **Animation frames** | `sprite_anim_<slug>` | one byte per frame | The SAT **pattern-name** byte for each frame — `slot` at 8×8, `slot * 4` at 16×16 — so the data needs no arithmetic at runtime. One segment per animation; empty animations are skipped. |

- Scope options in `ExportDialog`: **Patterns** / **Colours** / **Animations** toggles, plus
  Current animation vs. All animations (mirroring the Current/All screens control).
- Formats: ca65, Z80 `db`, BASIC `DATA`, raw Binary, PNG — all reuse the existing renderers
  over the `ByteSegment` model, including Round 5's label-case option for the assembly
  dialects (`sprite_patterns` → `SpritePatterns`, etc.).
- PNG: a **sprite sheet** (every slot in a grid, each in its own colour on the backdrop) or a
  **filmstrip** of the current animation's frames, at a selectable scale.

### 14.7 `ProjectType` touch-point checklist

Round 3 shipped a bug where `repository.ts`'s index guard silently dropped every saved
multicolor project because it hadn't learned the new type. Adding `'sprite'` means auditing
every place that enumerates modes — check each of these during Phase 25/26 and tick it off:

- [x] `src/domain/types.ts` — `ProjectType`, `SpriteColors`, `SpriteAnimation`,
      `isSpriteColors`, **fix `isMulticolorColors`** (Decision 27) — Phase 25
- [x] `src/domain/modes.ts` — `MODES.sprite`, `ModeInfo.hasScreen`, `charsetCount`,
      `PROJECT_TYPES`/`isProjectType` — Phase 25
- [x] `src/domain/factory.ts` — `defaultColors`, settings, empty `screens`, starter animation
- [x] `src/domain/serialization.ts` — accepted `type` list, settings, colours,
      **zero**-screen rule, `animations` validation
- [x] `src/persistence/repository.ts` — `isSummary` type guard ← *the Round 3 bug*, now
      derived from `MODES` so it cannot recur
- [x] `src/domain/colors.ts` + `src/domain/export/tables.ts` + `src/stores/editor.ts` —
      narrow-by-elimination sites that assumed Graphics II once the other guards failed
- [x] `src/domain/export/tables.ts` — `spriteSegments` (Phase 28)
- [x] `src/domain/screenStatus.ts` — confirmed never reached: `EditorView`'s sprite branch
      renders no `ScreenPanel`, so no `MODES[type]` screen arithmetic runs for a screenless
      project. No change needed.
- [x] `src/utils/spriteRender.ts` — new sibling to `screenRender.ts` (Phases 26–27)
- [x] `src/stores/editor.ts` — selection, colour, size/mag, transforms, animations
- [x] `src/views/EditorView.vue` — third layout branch + mode-aware shortcuts
- [x] `src/components/projects/NewProjectDialog.vue` — fifth mode + size sub-choice
- [x] `src/components/editor/ExportDialog.vue` — `sprite` scope (Phase 28)
- [x] `src/components/editor/ProjectSettingsDialog.vue` — size conversion + hardware notes
- [x] `src/samples/index.ts` — sprite sample (Phase 29)
- [x] `README.md` — modes table, features, shortcuts, export, samples (Phase 29)

### 14.8 Phases

#### Phase 25 — Sprite Domain & Data Model ✅
- [x] `types.ts`: `'sprite'` added to `ProjectType`; new `SpriteSize` (8|16), `SpriteMag` (1|2),
      `SpriteColors` and `SpriteAnimation`; `ProjectSettings` gained `spriteSize`/`spriteMag`
      (and `backdrop` now documents its sprite use); `Project` gained `animations?`;
      `isSpriteColors` added and `isMulticolorColors` now also excludes `sprites` (Decision 27).
- [x] `modes.ts`: `MODES.sprite` (`columns/rows/cellCount = 0`, `cellWidth/cellHeight = 8`),
      `hasScreen` on every `ModeInfo` (Decision 28), `charsetCount('sprite') = 1`. Also added
      **`PROJECT_TYPES`** (derived from `MODES`) + `isProjectType` so mode lists can't go stale.
- [x] New `src/domain/sprites.ts` (standalone, no `modes` import — same shape as
      `multicolor.ts`): hardware constants (`SPRITE_PATTERN_COUNT/_BYTES/_TABLE_SIZE`,
      `SAT_ENTRY_BYTES`, `SAT_SIZE`, `SPRITE_TERMINATOR_Y`, `SPRITE_EARLY_CLOCK`,
      `SPRITE_MAX_ON_SCREEN/_PER_LINE`, `MIN_FPS`/`MAX_FPS`), slot math (`spriteCount`,
      `slotToPattern`, `patternToSlot`, `patternsForSlot`, `clampSlot`, `isValidSlot`,
      `spritePixelSize`), the quadrant mapping (`quadrantFor`), composite accessors
      (`spriteGrid`, `getSpritePixel`, `gridToPatterns`, `spritePatterns`, `spriteBytes`,
      `bytesToPatterns`), and animation helpers (`clampFps`, `moveFrame`,
      `frameToPatternName`).
- [x] `src/domain/spriteOps.ts`: fill · clear · invert · shift L/R/U/D (wrap) · rotate L/R ·
      flip H/V · setPixel over an N×N `SpriteGrid`, plus `transformSprite(charset, slot, size,
      op)` which reads → transforms → returns the slot's patterns in hardware order.
- [x] `factory.ts`: blank sprite project per §14.4 (`spriteSize` option, `screens: []`,
      256 white sprite colours, one starter animation).
- [x] `serialization.ts`: accepts `'sprite'`; requires `spriteSize ∈ {8,16}`,
      `spriteMag ∈ {1,2}` and a valid `backdrop`; requires `colors.sprites` = 256 palette
      indices; requires **exactly zero** screens (gated on `hasScreen`); validates
      `animations` (name/frames/fps, frame bound follows `spriteSize`); rejects `animations`
      on non-sprite projects. `validateSettings` now returns `{ g2CharsetMode, spriteSize }`.
- [x] `repository.ts`: `isSummary` now calls `isProjectType` instead of a hard-coded mode
      list — the Round 3 bug class is gone rather than patched, and the regression spec is
      `it.each(PROJECT_TYPES)` so it covers every future mode automatically (§14.7).
- [x] **Fallout fixed:** three sites narrowed the colour union *by elimination* and silently
      assumed Graphics II once the other guards failed — `colors.ts` `resolveRowColors`,
      `export/tables.ts` `colorTableBytes`, and the editor store's `activeColors`. A fifth
      colour model made them type-errors; all three now narrow positively with
      `isGraphics2Colors`.
- [x] Vitest (**68 new**, suite **313 green**): `sprites.spec.ts` (slot math, an explicit
      quadrant table, per-quadrant pixel reads, grid↔patterns round-trips at both sizes, byte
      views, animation helpers) and `spriteOps.spec.ts` (**every transform asserted equal to
      the `charOps` implementation at 8×8**, plus corner-rotation/seam-spanning checks at
      16×16), extended factory/modes/serialization/repository specs, and a sprite share-link
      round-trip. Type-check + lint + `VITE_BASE` build clean.
- **Exit criteria:** ✅ a valid sprite project can be created, (de)serialized, round-tripped
  through a share link, and pixel-addressed at both sizes, all under test; no UI yet.

#### Phase 26 — Sprite Editor UI ✅
- [x] `NewProjectDialog`: fifth mode card, with an 8×8 / 16×16 sub-choice shown only for
      `type === 'sprite'` (same slot the GMII charset-mode choice occupies); defaults to 16×16.
- [x] `PixelEditor.vue` generalised to a purely presentational grid: `pixels: boolean[]` +
      `colors: number[]` (palette index per cell) computed by the parent, `paint(x, y, on)`
      emitted back, and quadrant seams at 16×16 (`quadrantGuides`). It no longer imports
      `charOps` or knows what a pattern is. `CharacterPanel` feeds it `charOps`-derived values
      so character-mode behaviour is unchanged; `SpritePanel` feeds it `spriteGrid`.
      *Deviation:* one square `size` prop instead of `width`/`height` — every grid this app
      edits is square, and the column count drives an inline `gridTemplateColumns` (Tailwind
      has no static `grid-cols-16`).
- [x] New `SpritePanel.vue`: pixel editor + single-select colour picker + backdrop picker
      (both undoable) + transform rows + `CharBytesBox`, with a slot readout that also shows
      the hardware pattern name at 16×16 (`#3 · pat 12`) and an explicit warning when a sprite
      is coloured Transparent (invisible on hardware).
- [x] `ColorPicker`: `singleSelect` was reaching into the store for `paintColor`; it now takes
      `selected` and emits `select`, so the same component drives multicolor's paint colour
      *and* a sprite's own colour. `MulticolorPanel` updated to pass them.
- [x] `CharBytesBox` / `src/domain/bytes.ts`: `parseBytes(text, expected)` — 8 bytes at 8×8,
      **32** at 16×16 in hardware quadrant order; `formatBytes` unchanged and existing callers
      keep the 8-byte default. The box now takes `bytes` (not `pattern`) and commits through
      `editor.setPatternBytes`, which dispatches by mode.
- [x] New `SpritePicker.vue` + `SpriteGrid.vue` (modelled on `CharsetPicker`/`CharsetGrid`):
      16 × 16 slots at 8×8 or 8 × 8 slots at 16×16 — a 128×128 logical sheet either way — each
      drawn in its own colour over the backdrop, selection ring, grid overlay, live re-render,
      and a magenta corner marker on colour-0 (invisible) slots. Export button lands in Phase 28.
- [x] `ProjectSettingsDialog`: sprite-size switch (8×8 ↔ 16×16) as an undoable command with
      direction-specific copy explaining what happens to colour (Decisions 24 + 34), plus the
      §14.3 **Hardware notes** block — 32 on screen / 4 per line, priority, colour 0, not in
      Text Mode (Decision 33).
- [x] **Post-smoke-test fix (Decision 34):** splitting 16×16 → 8×8 now spreads each quad's
      colour to its four pattern entries, so the sprites keep the colour they were showing
      instead of reverting three of every four to their never-set 8×8 entry. Three specs
      cover it, including a literal replay of the reported smoke test and an undo that
      restores four distinct pre-split colours exactly.
- [x] `EditorView`: third layout branch (sprite editor + picker | preview, tabs relabelled
      Sprite / Preview below `lg`) and a mode-aware shortcut map — `[`/`]` step sprite slots,
      the screen-only bindings (`,` `.` `G` `+` `-`) go inert, and every transform key routes
      through `applyTransform`.
- [x] `stores/editor.ts`: `selectedSprite`/`selectSprite`, `isSprite`, `spriteSize`,
      `spriteMag`, `spriteSlots`, `spriteColor`, `currentSpriteGrid`, `currentSpriteBytes`,
      `executeSpriteChange` (all four patterns of a 16×16 slot as **one** command),
      `setSpriteColor`, `setSpriteSize`, `setSpriteMag`, `spriteTransform`, `setPatternBytes`,
      and a sprite-aware `paintPixel`. `setBackdrop` now accepts sprite projects too.
- [x] **`applyTransform(name)` consolidation.** Rather than branch on mode at every call site,
      the store gained a `TransformName` map pairing each transform's label with its `charOps`
      *and* `spriteOps` implementation. `SpritePanel`, and the keyboard map both call
      `applyTransform`, so neither knows which mode is open, and the undo labels stay identical
      to `v1.3.1`. `transform(label, fn)` is retained for the existing character call sites.
- [x] **Pulled forward from Phase 27** so the right column isn't a dead placeholder:
      `src/utils/spriteRender.ts` (`drawSprite`/`fillBackdrop`/`renderSpriteFrame`/
      `spriteColorOf`, shared with the picker), `SpritePreview.vue` (backdrop + hardware
      magnification, then view zoom), and `AnimationPanel.vue` as the preview shell with zoom,
      a MAG 1×/2× toggle, and undo/redo. Phase 27 adds the animations, transport, and frame
      strip inside it.
- [x] Vitest (**39 new**, suite **352 green**): 16 store specs (slot clamping, quadrant-correct
      painting, stroke coalescing across quadrants, `applyTransform` in both modes, colour at
      the quad base with siblings untouched, lossless size conversion, magnification,
      32-byte paste, shared backdrop, and every no-op guard), `parseBytes` at custom lengths,
      `PixelEditor` at 16×16 (cell count, template columns, coordinate math, row stride,
      quadrant guides), a `SpritePanel` integration spec mounted against a real store, and a
      `spriteRender` spec asserting all four quadrants land at the right canvas coordinates.
- **Exit criteria:** ✅ create a sprite project at either size and draw, colour, transform and
  paste-to-set a sprite end-to-end with working undo/redo; switching size preserves every
  pattern and colour. Type-check + lint + `VITE_BASE` build clean.
  *(Verified via the store/component specs and a production build that compiles every template;
  no in-browser pass — no browser driver in this environment.)*

#### Phase 27 — Animations & Live Preview ✅
- [x] `stores/editor.ts`: `selectedAnimation`/`selectAnimation`, `animations`,
      `animationCount`, `currentAnimation`, `frameCount`, `previewSlot`, and undoable
      `addAnimation` · `removeAnimation` (never the last one) · `renameAnimation` ·
      `setAnimationFps` · `addFrame` · `removeFrame` · `reorderFrame` · `setFrame`, all
      routed through one `executeFramesChange` helper. Playback state (`playing`,
      `selectedFrame`) is view state — not undoable, not persisted — with `selectFrame`,
      `stepFrame` (wrapping), `setPlaying` and `togglePlaying`.
      *Naming note:* the frame-reorder action is `reorderFrame` in the store, since
      `moveFrame` is the pure `sprites.ts` helper it delegates to.
- [x] `src/utils/spriteRender.ts`: added `SPRITE_SHEET_SIZE`/`sheetColumns`,
      `renderSpriteSheet` (with an optional colour-0 marker) and `renderFilmstrip`, plus the
      `spriteSheetToCanvas`/`filmstripToCanvas` upscalers Phase 28's PNG export will call.
      `SpriteGrid.vue` now renders through `renderSpriteSheet` instead of its own copy of the
      loop, so the picker and the exported sheet cannot drift apart.
- [x] `AnimationPanel.vue` filled in around the Phase 26 preview shell: zoom · MAG 1×/2× ·
      transport (step back / play-pause / step forward) · fps stepper (1–30) · undo/redo ·
      animation paginator ‹ 1/n › with rename/add/delete and the same dialog pattern as the
      screen paginator. The preview reports the on-screen size and says when it is falling
      back to the edited sprite.
- [x] New `FrameStrip.vue`: ordered thumbnails (each a `SpritePreview`), click to select
      (which pauses), move left/right, retarget the selected frame at the edited sprite,
      append, remove, and a dashed empty state explaining how to add the first frame.
- [x] rAF playback loop per Decision 31 — seeded from `performance.now()`, driven by the
      animation's `fps` rather than the repaint rate, and stopped on pause, on unmount, and
      below two frames. `EditorView` binds `Space` to play/pause and `,`/`.` to the animation
      paginator in sprite mode.
- [x] `vitest.setup.ts`: stub `HTMLCanvasElement.getContext` to return `null`. jsdom has no
      canvas, so every mounted canvas component was printing a "Not implemented" error —
      noise that would bury a real failure. Components already treat a null context as
      "nothing to draw"; the pure renderers are covered by their own recording-context specs.
- [x] Vitest (**28 new**, suite **383 green**): 14 store specs (add/remove/rename/fps/frame
      ops with undo, the last-animation guard, out-of-range no-ops, slot-range validation,
      wrapping playhead, the two-frame play guard, preview fallback, and non-sprite
      projects), 9 `AnimationPanel` specs including a **driven rAF loop** asserting the
      playhead advances on the fps interval and not before, stops on pause and on unmount,
      and 5 renderer specs for sheet layout, the colour-0 marker, and filmstrip spacing.
- **Exit criteria:** ✅ build a multi-frame animation, play it back at a chosen fps with
  magnification and backdrop applied, scrub frames, and undo every structural change.
  *(Verified via the store/component specs — including the playback loop — and a production
  build; no in-browser pass, no browser driver in this environment.)*

#### Phase 28 — Sprite Export ✅
- [x] `src/domain/export/tables.ts`: `spriteSegments(project, selection)` per §14.6 —
      `sprite_patterns` (the full 2048-byte table, already in hardware quadrant order),
      `sprite_colors` (one byte per *slot*, so 256 at 8×8 and 64 at 16×16, masked to the low
      nibble with the early-clock bit clear), and one `sprite_anim_<slug>` per selected
      animation. Slugs come from the existing `labelSlug` and are de-duplicated with a `_2`,
      `_3`, … suffix, since two animations may legitimately share a name and duplicate labels
      would not assemble. Empty animations are skipped. The byte builders
      (`spritePatternBytes`/`spriteColorBytes`/`spriteFrameBytes`) are exported for testing.
- [x] `ExportDialog.vue`: new `sprite` scope with Patterns / Colours / Animations toggles and
      Current vs. All animations; live preview, Copy, Download all unchanged. PNG offers
      **Sprite Sheet** (the 128×128 slot sheet) or **Film Strip** (the current animation's
      frames on a 32px stage, wide enough for 16×16 at MAG 2). Round 5's label-case fieldset
      applies unchanged to ca65/Z80. The scope-specific PNG canvas moved into one `pngCanvas`
      helper rather than a third nested ternary.
- [x] Entry point: an **Export Sprites** button in the `SpritePicker` header opens scope
      `sprite`. No screen scope exists in this mode.
- [x] Fixed a plural bug found by the dialog spec: the segment header read
      "(1 frames @ 8 fps)".
- [x] Vitest (**17 new**, suite **400 green**): 9 domain specs (pattern-table size and byte
      order, per-slot colour counts at both sizes with siblings excluded, low-nibble masking,
      the `slot × 4` pattern-name conversion, 8×8 identity, empty-animation skipping, slug
      de-duplication across `Walk`/`walk!`/`WALK`, the table toggles, and rendering through
      the assembly pipeline with PascalCase labels) plus 8 `ExportDialog` specs mounted
      against a real store (title, live ca65 preview, pluralisation, toggles, current-vs-all
      animations, sprite-sheet and film-strip PNG dimensions and filenames, the empty-animation
      guard on Download, and the binary byte count).
- **Exit criteria:** ✅ a sprite project exports to ca65, Z80, BASIC, binary and PNG; the
  emitted pattern bytes carry the on-screen sprites in hardware order and the frame tables
  index them as SAT pattern names.

#### Phase 29 — Sample, README, Versioning & Release
- [x] Bundled sprite **sample project** — `Sample — Astro Ace` (`astro-ace`) in
      `src/samples/index.ts`: nine 16×16 sprites across three animations — a ship cycling
      three exhaust lengths, a two-pose alien walk, and a four-frame explosion whose slots
      run light yellow → dark yellow → medium red → dark red, demonstrating that colour is
      per sprite slot. Authored as 16-row ASCII art fed through the tested `gridToPatterns`,
      so the art stays readable instead of being hand-interleaved into quadrants.
- [x] Samples spec generalised for a screenless mode (`hasScreen` gate) plus four sprite
      assertions: pixels exist, every animation frame is in range **and non-blank**, and no
      animated sprite is coloured transparent (an invisible sample would look broken).
- [x] README: five project types in the intro and the modes table, **Sprite editor** and
      **Sprite animations** feature bullets, a new **Sprites** section covering the hardware
      facts (global size/magnification, the column-major 16×16 quadrant order, 32-on-screen /
      4-per-line, priority by index, colour 0), the sprite export table, the shortcut deltas,
      and the Astro Ace sample.
- [x] **Fixed while documenting the shortcuts:** the animation panel's zoom buttons advertised
      `+`/`-`, but the zoom was component-local so the global handler couldn't reach it — and
      `+`/`-` were explicitly inert in sprite mode. Moved to `editor.previewScale` /
      `zoomPreview`, matching Decision 31 and the way screen scale moved into the store in
      Phase 8. The shortcuts now work and the tooltips are honest.
- [x] PLAN Current Status + all Round 7 checkboxes updated; §14.7 checklist fully ticked.
- [x] Bumped `package.json` to `1.4.0` (surfaces via `__APP_VERSION__` → manager footer);
      suite **406 green**; type-check + lint + `VITE_BASE=/TMS9918-EDITOR/` build clean.
- [x] Committed (`382a561`), tagged `v1.4.0`, pushed to `origin/main`, and published the
      GitHub release (<https://github.com/acwright/TMS9918-EDITOR/releases/tag/v1.4.0>).
- **Exit criteria:** ✅ README reflects Round 7, the sprite "Astro Ace" sample ships with
  three working animations, and `v1.4.0` is tagged, pushed, and released.

### 14.9 Post-release fixes (on `main`, after `v1.4.0`)

Found by the user smoke-testing the released build, plus one latent bug the resulting
regression test uncovered. Both are on `main`; whether they warrant a `v1.4.1` tag is open.

1. **The sample grid orphaned its fifth card.** Round 6 Decision 22 set the grid to
   `lg:grid-cols-4` for exactly four samples, so Astro Ace wrapped onto a row of its own.
   Rather than hard-code 5 — which a sixth sample would break in the same way — the column
   count is now driven by the data: `--sample-cols` is bound from `SAMPLES.length` and
   consumed by `lg:grid-cols-[repeat(var(--sample-cols),minmax(0,1fr))]`. Cards stretch to
   the tallest description, so they stay level. Verified the rule is actually emitted inside
   the `lg` media query in the built CSS, not silently dropped by Tailwind.
2. **`ShareDialog` threw on every manager visit.** Its `{ immediate: true }` watcher runs
   during setup and reads `copied`, which was declared 14 lines *below* it — a temporal-dead-
   zone `ReferenceError`, thrown on every mount since `v1.3.0` (Phase 22). The dialog is
   rendered unconditionally, so it fired on every visit to the project manager. Impact was
   limited to a logged error: the immediate run would have returned early anyway, and later
   runs happen after setup completes, so sharing itself always worked. Fixed by hoisting the
   declaration above the watcher.

**Testing note.** The first two attempts at a regression test for (2) *passed against the
broken code*: the watcher is `async`, so the failure is a rejected promise that settles a
tick after `mount()` returns — after a `console.error` spy had been restored, and after the
assertion ran. The working version installs an `app.config.errorHandler` via VTU's
`global.config` and awaits `flushPromises()` before asserting. It was confirmed to fail
against the un-hoisted code and pass against the fix. A new `ProjectManagerView` spec also
covers the sample-grid column binding.
