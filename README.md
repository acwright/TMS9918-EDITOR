TMS9918-EDITOR
==============

A browser-based character set and screen editor for the [TMS9918](https://en.wikipedia.org/wiki/Texas_Instruments_TMS9918)
Video Display Processor — the graphics chip behind the TI-99/4A, ColecoVision, MSX,
Memotech, and many other early-1980s machines.

Design 8×8 character patterns, colour them with the TMS9918's 15-colour palette, lay
them out across one or more screens, and copy the results straight out as `ca65`
assembler bytes. Everything runs client-side; projects are saved in your browser and can
be downloaded or shared as JSON.

![Editor screenshot](docs/screenshot.png)


## Features

- **Three VDP modes**, each with its hardware-accurate colour model:
  | Mode | Screen | Cell | Charsets | Colour |
  |---|---|---|---|---|
  | Text | 40×24 | 6×8 | 1×256 | one global fg/bg pair |
  | Graphics I | 32×24 | 8×8 | 1×256 | fg/bg per 8-character group (32 groups) |
  | Graphics II | 32×24 | 8×8 | 1×256 mirrored **or** 3×256 independent (screen thirds) | fg/bg per pixel row |
- **8×8 pixel editor** with fill / clear / invert, wrapping shifts, rotate, and flip —
  every edit undoable.
- **Character-set picker** rendering all 256 glyphs in their true colours, with a
  Graphics II mirrored↔independent charset converter.
- **Colour picker** (2×8 palette, transparent as checkerboard) with F/B foreground/background
  targeting, Graphics I group highlighting, and Graphics II per-row colour chips.
- **Screen editor** — paint characters onto a scalable (1×–8×) grid, with per-screen
  transforms, a toggleable grid overlay, and multiple named screens per project.
- **Live `ca65` output** for the selected character, one click to copy.
- **Project-wide undo/redo**, debounced autosave to localStorage, and JSON import/export.
- **Keyboard-driven** (see below) and **touch-friendly** — the layout collapses to
  Character / Screen tabs on tablet-sized viewports.

## Sample Projects

The project manager has a **Load a Sample** row with one project per mode — a good way to
see the colour models in action or to start a screenshot:

- **Text Greeting** — a complete printable-ASCII 5×7 font with a greeting and font sampler.
- **Landscape** — a Graphics I scene (sky, sun, clouds, hills, grass) showing per-group colours.
- **Icons** — a Graphics II grid of a multicolour smiley and a gradient heart (per-row colours).

## Keyboard Shortcuts

`Ctrl` is `⌘` on macOS; `Alt` is `⌥`.

### Everywhere in the editor

| Shortcut | Action |
|---|---|
| `Ctrl+Z` | Undo |
| `Shift+Ctrl+Z` | Redo |
| `Ctrl+S` | Save now |
| `Esc` | Back to projects (closes a dialog first if one is open) |

### Character

| Shortcut | Action |
|---|---|
| `[` / `]` | Previous / next character |
| `F` | Fill |
| `C` | Clear |
| `I` | Invert |
| `R` / `Shift+R` | Rotate right / left |
| `H` / `V` | Flip horizontal / vertical |
| `Alt+←` `→` `↑` `↓` | Shift pixels (wraps) |

### Screen

| Shortcut | Action |
|---|---|
| `+` / `-` | Zoom in / out |
| `G` | Toggle grid overlay |
| `,` / `.` | Previous / next screen |

### Project Manager

| Shortcut | Action |
|---|---|
| `N` | New project |

Shortcuts are disabled while typing in a text field or while a dialog is open.

## Development

Requires Node 22.18+ (or 24.12+).

```sh
npm install
npm run dev        # start the dev server (http://localhost:5173)
npm run test:unit  # run the Vitest suite
npm run lint       # oxlint + eslint
npm run build      # type-check + production build to dist/
```

## Deployment

The repo ships a GitHub Actions workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml))
that lints, tests, builds, and deploys to **GitHub Pages** on every push to `main`. It sets
Vite's `base` to `/<repo>/` automatically. To enable it, push to GitHub and set
**Settings → Pages → Source: GitHub Actions**.

## License

© 2026 A.C. Wright Design.
