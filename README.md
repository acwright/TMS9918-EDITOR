TMS9918-EDITOR
==============

A browser-based character set and screen editor for the [TMS9918](https://en.wikipedia.org/wiki/Texas_Instruments_TMS9918)
Video Display Processor — the graphics chip behind the TI-99/4A, ColecoVision, MSX,
Memotech, and many other early-1980s machines.

Design 8×8 character patterns, colour them with the TMS9918's 15-colour palette, lay
them out across one or more screens, and export the result as 6502 (`ca65`) or Z80
assembly, BASIC `DATA`, raw binary, or PNG. A dedicated **Multicolor** mode swaps glyph
editing for a 64×48 grid of chunky 4×4 colour blocks, and **Sprite** mode covers the
hardware's sprite layer — 8×8 or 16×16 patterns with animation playback. Everything runs
client-side; projects are saved in your browser, downloadable as JSON, and shareable as a
single self-contained link.

Runs in a browser, or as a native app for macOS, Windows and Linux — see
**[Desktop](#desktop)**.

![Editor screenshot](docs/screenshot.png)


## Features

- **Five project types**, each with its hardware-accurate colour model:
  | Mode | Screen | Cell | Patterns | Colour |
  |---|---|---|---|---|
  | Text | 40×24 | 6×8 | 1×256 | one global fg/bg pair |
  | Graphics I | 32×24 | 8×8 | 1×256 | fg/bg per 8-character group (32 groups) |
  | Graphics II | 32×24 | 8×8 | 1×256 mirrored **or** 3×256 independent (screen thirds) | fg/bg per pixel row |
  | Multicolor | 64×48 | 4×4 | — | one solid palette colour per block (no glyphs) |
  | Sprite | — | 8×8 or 16×16 | 1×256 (the 2 KB sprite pattern table) | one solid colour per sprite |
- **8×8 pixel editor** with fill / clear / invert, wrapping shifts, rotate, and flip —
  every edit undoable.
- **Character-set picker** rendering all 256 glyphs in their true colours, with a
  Graphics II mirrored↔independent charset converter.
- **Colour picker** (2×8 palette, transparent as checkerboard) with F/B foreground/background
  targeting, Graphics I group highlighting, and Graphics II per-row colour chips.
- **Screen editor** — paint characters onto a scalable (1×–8×) grid, with per-screen
  transforms, a toggleable grid overlay, multiple named screens per project, and a live
  pointer readout (cell coordinates, pixel origin, and the character or colour under the
  cursor).
- **Multicolor editor** — a stripped-down mode with no character or character-set panels:
  pick a colour and paint solid 4×4 blocks straight onto a 64×48 canvas, with a backdrop
  colour shown behind transparent blocks.
- **Sprite editor** — draw 8×8 or 16×16 sprites (16×16 composited from its four hardware
  patterns, with the quadrant seams marked), give each one a palette colour, and browse every
  slot in a sheet. Switching between 8×8 and 16×16 only regroups the patterns, so nothing is
  lost either way.
- **Sprite animations** — name any number of frame sequences, scrub or play them back at
  1–30 fps over the backdrop, with hardware 1×/2× magnification applied — see
  [Sprites](#sprites).
- **Character set panel, three ways** — the set as two scaled blocks of 128, as a scrolling grid
  that fills the width with 8, 16 or 32 glyphs a row, or as a list carrying each character's code
  and whether its slot is still blank. Pick whichever suits the window; the choice is remembered
  per browser, and a first visit on a phone starts in the grid.
- **Sprite picker, three ways** — the whole set as one scaled sheet, as a scrolling grid of
  fixed-size slots, or as a list carrying each slot's number, the hardware patterns it occupies,
  its colour, and whether it is blank or invisible. Remembered per browser, and independent of
  the character set's layout.
- **Character byte box** — view the selected glyph as comma-separated **hex** or **decimal**,
  copy it, or paste either form (or a `.byte` / `db` / `DATA` line) back in to set the character.
- **Export** to 6502 (`ca65`) or Z80 assembly, BASIC `DATA`, raw binary, or PNG — with separate
  buttons for the character set and for screens, and your choice of label casing
  (see [Export](#export)).
- **Share links** — hand someone the whole project as a URL (see [Sharing](#sharing)).
- **Project manager** — every saved project in one list, each row carrying its mode, last-modified
  time, and rename / duplicate / share / download / delete actions; the row splits over two lines
  on phone-sized viewports so nothing crowds the name.
- **Project-wide undo/redo**, debounced autosave to localStorage, and JSON import/export.
- **Keyboard-driven** (see below) and **touch-friendly** — the layout collapses to
  two tabs on tablet-sized viewports.

## Sample Projects

The project manager has a **Load a Sample** row with one project per mode — a good way to
see the colour models in action or to start a screenshot:

- **Text Greeting** — a complete printable-ASCII 5×7 font with a greeting and font sampler.
- **Platform Climb** — a Graphics I arcade platformer (girders, ladders, barrels, a hero and a
  prize) where every tile type carries one flat colour — the mode's per-group colour model.
- **Star Voyager** — a Graphics II space battle drawn as a full 256×192 bitmap (a ringed planet,
  nebula, starfield, a fighter and its laser) — the near-bitmap, two-colours-per-row model, using
  an independent 3-charset layout.
- **Vista** — a Multicolor 64×48 block scene (hills, sun, clouds) with a full-palette strip.
- **Astro Ace** — a Sprite project with three 16×16 animations: a ship cycling its exhaust, a
  walking alien, and a four-frame explosion that cools from yellow to dark red (colour is per
  sprite, so a sequence can change colour even though each frame is one solid hue).

## Sprites

Sprites are a separate hardware layer that overlays Graphics I, Graphics II or Multicolor
(never Text Mode), so a **Sprite** project is a companion to a screen project rather than a
variant of one — it has no screen of its own. What it holds is the 2 KB **Sprite Pattern
Table**, a colour per sprite, and any number of named animations.

Useful hardware facts, all of which the editor documents rather than enforces:

- **Size and magnification are global.** VDP register 1 selects 8×8 or 16×16 patterns and 1× or
  2× magnification for *every* sprite at once, so both are project settings. Together they give
  8, 16, or 32 pixels on screen.
- **A 16×16 sprite is four patterns**, and the hardware reads them column-major — top-left,
  **bottom-left**, top-right, bottom-right. The editor draws it as one 16×16 grid (with the
  quadrant seams marked) and handles the interleaving for you.
- **32 sprites on screen, but only 4 per scan line.** The fifth and beyond vanish on that line.
- **Lower sprite numbers draw in front** of higher ones.
- **Colour 0 is transparent** — the sprite is invisible but still consumes one of the four
  per-line slots. The picker marks such sprites so an invisible one isn't mistaken for an empty
  one, and the list layout names both cases outright.

The picker offers three layouts, and remembers which one you picked (per browser, and separately
from the character set panel's):

- **Sheet** — every slot at once in one square image, scaled to the space. Best with height to
  spare, and the layout the PNG export writes.
- **Grid** — fixed-size slots, as many a row as the column fits, scrolling. Best for picking a
  sprite out when the sheet has shrunk each slot to a thumbnail.
- **List** — one slot a row with its number in both bases, the patterns it occupies (`pat 48–51`
  for a 16×16 quad), its colour by name, and **Blank** / **Invisible** badges. Best for finding a
  sprite by number, or for finding a free slot to draw in.

Animations are an editor concept, not a hardware one: each is an ordered list of sprite slots
with a frame rate, played back in the preview and exported as a table of pattern numbers you can
step through in your own code.

## Export

Three entry points, each opening the same export dialog:

- **Export Character Set** (download icon in the Character Set header) — the pattern table and/or
  colour table for the current set. Graphics II independent projects can pick one set or all three.
- **Export Screen** (download icon in the screen toolbar) — the name table for the current screen
  or all screens.
- **Export Sprites** (download icon in the Sprites header) — the sprite pattern table, the
  per-sprite colour bytes, and animation frame tables.

Formats:

| Format | Notes |
|---|---|
| **6502 (`ca65`)** | `.byte $XX, …` with labelled segments — the cc65 toolchain. |
| **Z80** | `db $XX, …` for WLA-DX / sjasmplus / tniasm (MSX, ColecoVision, SG-1000). |
| **BASIC** | Decimal `DATA` lines with a configurable start line and step (TI/MSX BASIC). |
| **Binary** | Raw `.bin` of the selected tables. |
| **PNG** | The screen, a 16×16 sheet of the character set, or a sprite sheet / animation film strip, at a selectable 1×–8× scale. |

Assembly exports (6502 and Z80) also offer a **Labels** picker — `snake_case` (the default),
`ALL CAPS`, `camelCase`, or `PascalCase` — so generated labels match the convention of the
surrounding source. The choice is remembered between sessions. Only cases that are valid
assembler identifiers are offered; kebab-case would emit a `-` operator.

Colour bytes pack as `(fg << 4) | bg`, matching the TMS9918 colour table. Text mode emits one
colour byte, Graphics I emits 32 (one per 8-character group), Graphics II emits 8 per character.

**Multicolor** projects export from the screen toolbar only (there is no character set): each
screen's synthesised **Pattern Generator** (1536 bytes) plus a shared **Name Table** (768 bytes,
a fixed framebuffer layout). The block colours live in the pattern nibbles, so there is no
colour table.

**Sprite** projects emit up to three kinds of table, each independently toggleable:

| Table | Label | Bytes | Contents |
|---|---|---|---|
| Pattern table | `sprite_patterns` | 2048 | All 256 patterns, already in hardware quadrant order. |
| Colours | `sprite_colors` | 256 (8×8) or 64 (16×16) | One byte per sprite — drop straight into Sprite Attribute Table byte 4. |
| Animation | `sprite_anim_<name>` | one per frame | Each frame's pattern number (`slot × 4` at 16×16), ready to write to attribute byte 3. |

No Sprite Attribute Table is emitted, because the editor doesn't model sprite *positions* —
you supply X/Y at runtime and use these tables for the pattern and colour bytes.

**Magellan interop** — Magellan and other TMS9918 tools import raw binary pattern/colour/name
tables, so use the **Binary** export to move data between them; there's no native `.mag` project
format.

Single characters can also be copied or pasted through the character byte box (hex or decimal).

## Sharing

The **Share Link** button on each project in the project manager produces a URL that carries
the entire project — character sets, colours, and every screen — gzip-compressed into the
URL's fragment:

```
https://acwright.github.io/TMS9918-EDITOR/#p=1H4sIA…
```

Nothing is uploaded: URL fragments are never sent to a server, so the link *is* the project.
Opening one offers to add a copy to that browser's project list; the original is untouched.

Compression keeps typical projects to a few hundred characters up to a couple of KB. A maxed-out
Graphics II project (three charsets, a per-row colour table, several screens) still lands in the
single-digit KB range, but the dialog warns once a link passes ~2,000 characters, because some
chat apps and link previewers truncate long URLs — send the downloaded `.tms9918.json` file in
that case.

## Keyboard Shortcuts

Every key below is also listed in the app: the **Keyboard Shortcuts** button in either header — or
`?` — opens the same map, taken from the same source as this table, filtered to the keys the open
project's mode actually answers to. On Apple platforms `Ctrl/Cmd` is `⌘`, `Alt` is `⌥` and `Shift`
is `⇧`.

### Project

| Key                | Action                   |
| ------------------ | ------------------------ |
| `Ctrl/Cmd+Z`       | Undo                     |
| `Shift+Ctrl/Cmd+Z` | Redo                     |
| `Ctrl/Cmd+S`       | Save now                 |
| `?`                | Keyboard shortcuts       |
| `Esc`              | Back to the project list |
| `Esc`              | Close the document       |

In the desktop app `Esc` closes the open document and returns to the start screen; in the browser
it returns to the project list.

### Character

Multicolor projects paint palette entries straight onto the screen and have no character panel, so
none of these keys apply there.

| Key       | Action                  |
| --------- | ----------------------- |
| `[`       | Previous character      |
| `]`       | Next character          |
| `F`       | Fill the character      |
| `C`       | Clear the character     |
| `I`       | Invert the character    |
| `H`       | Flip horizontal         |
| `V`       | Flip vertical           |
| `R`       | Rotate right            |
| `Shift+R` | Rotate left             |
| `Alt+←`   | Shift the pattern left  |
| `Alt+→`   | Shift the pattern right |
| `Alt+↑`   | Shift the pattern up    |
| `Alt+↓`   | Shift the pattern down  |

### Screen

| Key       | Action          |
| --------- | --------------- |
| `,`       | Previous screen |
| `.`       | Next screen     |
| `+` / `=` | Zoom in         |
| `-`       | Zoom out        |
| `G`       | Grid overlay    |

### Character set list

The list layout of the character set is a listbox: it takes focus, and these keys move the
selection while it holds it.

| Key                   | Action                     |
| --------------------- | -------------------------- |
| `↑` / `↓`             | Previous or next character |
| `PageUp` / `PageDown` | Jump eight characters      |
| `Home` / `End`        | First or last character    |

### Sprite list

The list layout of the sprite picker is a listbox too, on the same contract.

| Key                   | Action                                     |
| --------------------- | ------------------------------------------ |
| `↑` / `↓`             | Previous or next sprite                    |
| `PageUp` / `PageDown` | Jump one sheet row (16 at 8×8, 8 at 16×16) |
| `Home` / `End`        | First or last sprite                       |

### Sprite projects

A sprite project has no screen, so the transform keys act on the whole sprite, the paging keys walk
its animations, `+` / `-` zoom the animation preview, and `G` does nothing.

| Key     | Action                      |
| ------- | --------------------------- |
| `[`     | Previous sprite             |
| `]`     | Next sprite                 |
| `F`     | Fill the sprite             |
| `C`     | Clear the sprite            |
| `I`     | Invert the sprite           |
| `,`     | Previous animation          |
| `.`     | Next animation              |
| `Space` | Play or pause the animation |

### Project list

| Key | Action             |
| --- | ------------------ |
| `N` | New project        |
| `?` | Keyboard shortcuts |

Shortcuts are disabled while typing in a text field or while a dialog is open, and `Space` and
`Enter` always belong to whichever control has focus.

## Desktop

The same editor as a native app for macOS, Windows and Linux. Download it from the
[latest release](https://github.com/acwright/TMS9918-EDITOR/releases/latest):

| Platform | File | Notes |
| --- | --- | --- |
| macOS (Apple silicon) | `tms9918-editor-<version>-mac-arm64.dmg` | Signed and notarized — opens without a Gatekeeper prompt |
| Windows (x64) | `tms9918-editor-<version>-win-x64.exe` | NSIS installer. Unsigned, so SmartScreen warns on first run — *More info → Run anyway* |
| Linux (x64) | `tms9918-editor-<version>-linux-x86_64.AppImage` | `chmod +x`, then run it |
| Linux (x64) | `tms9918-editor-<version>-linux-amd64.deb` | `sudo apt install ./tms9918-editor-<version>-linux-amd64.deb` |

Everything the web app does, the desktop app does — it is one renderer behind two shells,
not a port. What it adds:

- **A real menu bar**, with the keyboard map as accelerators. Menu items follow the open
  project: a Sprite project says "Fill the sprite", a Multicolor project greys out the
  pattern items, and the project list greys everything but *New project*.
- **Native save and open dialogs.** Every export — assembly, BASIC, binary, PNG, project
  JSON — goes through the system save sheet, so you choose the folder and the filename
  instead of fishing the file out of `~/Downloads`. Each kind of export remembers the
  directory you last used. Importing a project opens a real file panel.
- **Its own storage.** Projects live in the app's own `userData` directory rather than in
  a browser profile, so clearing browsing data cannot touch them, and they are flushed to
  disk on the way out — an edit made a moment before you quit is there on relaunch.
- **A window that remembers itself**, including which display it was on and whether it was
  maximized.
- **No network at all.** The web app is already client-side; the desktop app has no
  browser, no address bar and no tab.

The desktop app's projects are **separate** from the web app's — different storage, no
sync. Move one across with *Download* and *Upload* in the project list, or a share link.

### Building the desktop app from source

`npm run build` is the Electron build (it bundles main, preload and renderer to `out/`);
`npm run build:web` is the one that produces the Pages site. Packaging each platform is a
separate command, and each has a prerequisite:

```sh
npm run icons        # regenerate build/icon.{icns,ico,png} from the master PNG
npm run pack         # unpacked app in dist/mac-arm64 — no signing, quickest check
npm run dist:mac     # → dist/*.dmg      requires a Developer ID cert + notarization credentials
npm run dist:win     # → dist/*.exe      requires Wine (brew install --cask wine-stable)
npm run dist:linux   # → dist/*.AppImage, *.deb   requires Docker running
npm run dist         # all three, in that order
```

- **macOS** signs, notarizes and staples. It needs a *Developer ID Application* certificate
  in the keychain and `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` in the
  environment. Without them, use `npm run pack` — it skips signing entirely.
- **Windows** builds the NSIS installer under Wine. The installer *runs* only on real
  Windows: its script calls PowerShell's `Get-CimInstance`, which Wine stubs out.
- **Linux** builds in a container, so nothing has to be installed on the host but Docker.

If `npm run dev` or `npm run preview` dies with *"The requested module 'electron' does not
provide an export named 'BrowserWindow'"*, the shell has `ELECTRON_RUN_AS_NODE=1` set —
some editors' integrated terminals do — which makes the Electron binary run as plain Node.
Run it as `env -u ELECTRON_RUN_AS_NODE npm run dev`.

## Development

Requires Node 22.18+ (or 24.12+).

```sh
npm install
npm run dev        # the desktop app, with hot reload
npm run dev:web    # the browser app (http://localhost:5173)
npm run test:unit  # run the Vitest suite
npm run lint       # oxlint + eslint
npm run type-check # vue-tsc over the whole project
npm run build      # the Electron bundle    → out/
npm run build:web  # the standalone web app → dist/web/
```

One renderer, two shells. `src/renderer/` is the editor and knows nothing about
Electron; `src/main/` and `src/preload/` are the desktop shell, and `src/shared/`
is the handful of types the two sides agree on. The platform differences the
renderer *does* have — saving a file, mainly — sit behind small utilities that
fall back to a browser download. See [CLAUDE.md](CLAUDE.md) for the layout and
the decisions behind it, and [ELECTRON-PLAN.md](ELECTRON-PLAN.md) for the
measurements they rest on.

## Deployment

The repo ships two workflows. [deploy.yml](.github/workflows/deploy.yml) lints, tests,
builds and deploys to **GitHub Pages** on every push to `main`, setting Vite's `base` to
`/<repo>/` automatically; to enable it, push to GitHub and set **Settings → Pages →
Source: GitHub Actions**. [ci.yml](.github/workflows/ci.yml) runs the same gates on a pull
request, where there is nothing to deploy.

Both also run `electron-vite build`, so a change that breaks the main or preload process
fails in CI rather than at the next release. Neither *packages* the desktop app: a signed,
notarized dmg needs a macOS runner and Apple credentials, so the release artifacts are
built locally with the commands under [Desktop](#building-the-desktop-app-from-source).

## License

© 2026 A.C. Wright Design.
