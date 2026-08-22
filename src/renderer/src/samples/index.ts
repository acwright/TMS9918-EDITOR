/**
 * Bundled sample projects — one per mode — loadable from the project manager.
 * Each builder returns a fresh Project (new id + timestamps) so loading a
 * sample twice makes two independent projects.
 *
 * Characters are authored as ASCII art (`#` = pixel on, MSB = leftmost),
 * which keeps the pixel data readable and easy to tweak.
 */

import type { Graphics1Colors, Graphics2Colors, Project, SpriteColors } from '@/domain/types'
import { createProject } from '@/domain/factory'
import { MODES } from '@/domain/modes'
import { PALETTE } from '@/domain/palette'
import { gridToPatterns, slotToPattern } from '@/domain/sprites'
import { FONT } from './font'

export interface Sample {
  id: string
  name: string
  description: string
  build: () => Project
}

/** ASCII art (up to 8×8) → 8 pattern bytes. */
function glyph(rows: string[]): number[] {
  return Array.from({ length: 8 }, (_, y) => {
    const row = rows[y] ?? ''
    let byte = 0
    for (let x = 0; x < 8; x++) {
      if (row[x] === '#') byte |= 0x80 >> x
    }
    return byte
  })
}

function place(project: Project, x: number, y: number, code: number): void {
  const cols = MODES[project.type].columns
  const cells = project.screens[0]?.cells
  if (cells) cells[y * cols + x] = code
}

function write(project: Project, x: number, y: number, text: string): void {
  for (let i = 0; i < text.length; i++) place(project, x + i, y, text.charCodeAt(i))
}

function writeCentered(project: Project, y: number, text: string): void {
  write(project, Math.floor((MODES[project.type].columns - text.length) / 2), y, text)
}

// --- Text Mode: a greeting set in the full printable-ASCII 5×7 font ---

function textSample(): Project {
  const project = createProject({ name: 'Sample — Text Greeting', type: 'text' })
  const charset = project.charsets[0]
  if (charset) {
    for (const [char, art] of Object.entries(FONT)) {
      charset[char.charCodeAt(0)] = glyph(art)
    }
  }
  project.colors = { fg: 3, bg: 1 } // light green on black — terminal look

  writeCentered(project, 2, 'TMS9918 EDITOR')
  writeCentered(project, 4, 'Character & Screen Editor')
  writeCentered(project, 6, 'for the TMS9918 VDP')
  // A quick tour of the bundled font
  writeCentered(project, 10, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')
  writeCentered(project, 12, 'abcdefghijklmnopqrstuvwxyz')
  writeCentered(project, 14, '0123456789')
  writeCentered(project, 16, '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~')
  writeCentered(project, 20, 'The quick brown fox jumps')
  writeCentered(project, 21, 'over the lazy dog.')
  return project
}

// --- Graphics Mode I: a tile-based arcade platformer ---
//
// Graphics I ties one fg/bg pair to each *group of 8 consecutive character
// codes*, so colour is chosen per tile-*type*, not per cell. This scene lays
// each kind of tile (girder, ladder, hero, barrel, prize, HUD text) into its
// own code group and gives that group a single colour — the flat, blocky
// colour model the mode is known for.

/** Code groups (8 codes each). Every code in a group shares one fg/bg pair. */
const G1 = {
  GIRDER: 8, // group 1
  LADDER: 16, // group 2
  HERO: 24, // group 3
  BARREL: 32, // group 4
  PRIZE: 40, // group 5
  TEXT: 128, // groups 16–31: the HUD font (one white-on-black colour)
} as const

function platformSample(): Project {
  const project = createProject({ name: 'Sample — Platform Climb', type: 'graphics1' })
  const charset = project.charsets[0]
  const colors = project.colors as Graphics1Colors
  if (!charset) return project

  // Tiles — one representative glyph per code group.
  charset[G1.GIRDER] = glyph([
    '########',
    '##.##.##',
    '########',
    '.#....#.',
    '.#....#.',
    '........',
    '........',
    '........',
  ]) // riveted girder sitting in the top of its cell
  charset[G1.LADDER] = glyph([
    '.#....#.',
    '.######.',
    '.#....#.',
    '.######.',
    '.#....#.',
    '.######.',
    '.#....#.',
    '.######.',
  ]) // twin rails + rungs, full height
  charset[G1.HERO] = glyph([
    '..####..',
    '..####..',
    '.#.##.#.',
    '.######.',
    '..####..',
    '.#.##.#.',
    '.#....#.',
    '.##..##.',
  ]) // a little climber
  charset[G1.BARREL] = glyph([
    '.######.',
    '#.#..#.#',
    '##.##.##',
    '#.#..#.#',
    '##.##.##',
    '#.#..#.#',
    '##.##.##',
    '.######.',
  ]) // rolling barrel
  charset[G1.PRIZE] = glyph([
    '.##.##..',
    '#######.',
    '#######.',
    '#######.',
    '.#####..',
    '..###...',
    '...#....',
    '........',
  ]) // heart to rescue at the top

  // One colour per tile type — the whole point of Graphics I.
  colors.groups[0] = { fg: 15, bg: 1 } // empty sky: black
  colors.groups[G1.GIRDER / 8] = { fg: 8, bg: 1 } // girders: medium red
  colors.groups[G1.LADDER / 8] = { fg: 7, bg: 1 } // ladders: cyan
  colors.groups[G1.HERO / 8] = { fg: 9, bg: 1 } // hero: light red
  colors.groups[G1.BARREL / 8] = { fg: 10, bg: 1 } // barrels: dark yellow
  colors.groups[G1.PRIZE / 8] = { fg: 13, bg: 1 } // prize: magenta
  for (let g = 16; g < 32; g++) colors.groups[g] = { fg: 15, bg: 1 } // HUD text: white

  // HUD font: copy just the glyphs we print into the text code range, keeping a
  // char→code map so shared letters reuse a code (Graphics I has 256 codes).
  const textCode = new Map<string, number>()
  let nextText = G1.TEXT
  const hud = (x: number, y: number, str: string): void => {
    for (const ch of str.toUpperCase()) {
      let code = textCode.get(ch)
      if (code === undefined && nextText < 256) {
        code = nextText++
        textCode.set(ch, code)
        charset[code] = glyph(FONT[ch] ?? FONT['?']!)
      }
      if (code !== undefined) place(project, x, y, code)
      x++
    }
  }

  const { columns } = MODES.graphics1

  // Girder platforms (the top 3px of each cell) with a stepped gap or two.
  const floors = [22, 18, 14, 10, 6]
  for (const y of floors) for (let x = 0; x < columns; x++) place(project, x, y, G1.GIRDER)
  place(project, 15, 18, 0) // a gap to jump/climb around
  place(project, 16, 14, 0)

  // Ladders threaded between the platforms.
  const ladder = (x: number, top: number, bottom: number): void => {
    for (let y = top; y < bottom; y++) place(project, x, y, G1.LADDER)
  }
  ladder(4, 19, 22) // ground → floor 1
  ladder(27, 15, 18) // floor 1 → 2
  ladder(7, 11, 14) // floor 2 → 3
  ladder(23, 7, 10) // floor 3 → 4

  // Actors.
  place(project, 2, 21, G1.HERO) // hero on the ground floor
  place(project, 20, 17, G1.BARREL) // barrels on the ramps
  place(project, 10, 13, G1.BARREL)
  place(project, 25, 9, G1.BARREL)
  place(project, 15, 5, G1.PRIZE) // prize on the top floor

  // HUD across the top two rows.
  hud(1, 0, '1UP   007650')
  hud(1, 2, 'HIGH  031200')
  hud(24, 0, 'STAGE-1')
  hud(24, 2, 'LIVES-3')

  return project
}

// --- Graphics Mode II: a full-screen bitmap space battle ---
//
// Graphics II gives every 8-pixel row of every cell its own fg/bg pair. With an
// *independent* charset (256 unique glyphs per screen third) the whole 256×192
// display becomes a near-bitmap: any two colours per horizontal 8-pixel strip.
// We paint a scene onto a plain pixel canvas, then fit it to the hardware — the
// exact opposite of Graphics I's flat, tile-coloured look.

const CANVAS_W = 256
const CANVAS_H = 192

function rgbOf(index: number): [number, number, number] {
  const hex = PALETTE[index]?.hex
  if (!hex) return [10, 10, 10]
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function colorDist(a: number, b: number): number {
  const [ar, ag, ab] = rgbOf(a)
  const [br, bg, bb] = rgbOf(b)
  return (ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2
}

/**
 * Fit one 8-pixel row to the hardware's two-colours-per-row limit: pick the
 * fg/bg pair that best represents the strip (least colour error), then set a
 * bit wherever the pixel is nearer fg than bg.
 */
function fitRow(px: number[]): { fg: number; bg: number; byte: number } {
  const distinct = [...new Set(px)]
  let fg = distinct[0]!
  let bg = distinct[1] ?? distinct[0]!
  if (distinct.length > 2) {
    let best = Infinity
    for (let i = 0; i < distinct.length; i++) {
      for (let j = i + 1; j < distinct.length; j++) {
        let err = 0
        for (const p of px) err += Math.min(colorDist(p, distinct[i]!), colorDist(p, distinct[j]!))
        if (err < best) {
          best = err
          fg = distinct[i]!
          bg = distinct[j]!
        }
      }
    }
  }
  let byte = 0
  if (fg !== bg) {
    for (let k = 0; k < 8; k++) {
      if (colorDist(px[k]!, fg) < colorDist(px[k]!, bg)) byte |= 0x80 >> k
    }
  }
  return { fg, bg, byte }
}

/** Slice a 256×192 palette-index canvas into an independent Graphics II project. */
function fitCanvasToG2(project: Project, canvas: number[]): void {
  const charsets = project.charsets // [set0, set1, set2]
  const colors = project.colors as Graphics2Colors
  const cells = project.screens[0]!.cells
  const cols = MODES.graphics2.columns

  for (let third = 0; third < 3; third++) {
    for (let ly = 0; ly < 8; ly++) {
      for (let lx = 0; lx < cols; lx++) {
        const code = ly * cols + lx // unique 0–255 within the third
        const cy = third * 8 + ly
        const pattern: number[] = []
        const rowColors: { fg: number; bg: number }[] = []
        for (let r = 0; r < 8; r++) {
          const py = cy * 8 + r
          const strip: number[] = []
          for (let k = 0; k < 8; k++) strip.push(canvas[py * CANVAS_W + (lx * 8 + k)]!)
          const { fg, bg, byte } = fitRow(strip)
          pattern.push(byte)
          rowColors.push({ fg, bg })
        }
        charsets[third]![code] = pattern
        colors.rows[third]![code] = rowColors
        cells[cy * cols + lx] = code
      }
    }
  }
}

// -- Canvas drawing primitives (palette indices; background = black) --

function makeCanvas(fill: number): number[] {
  return Array.from({ length: CANVAS_W * CANVAS_H }, () => fill)
}

function px(canvas: number[], x: number, y: number, c: number): void {
  if (x >= 0 && x < CANVAS_W && y >= 0 && y < CANVAS_H) canvas[y * CANVAS_W + x] = c
}

function hBands(canvas: number[], bands: { to: number; c: number }[]): void {
  let y = 0
  for (const { to, c } of bands) {
    for (; y < to && y < CANVAS_H; y++) for (let x = 0; x < CANVAS_W; x++) px(canvas, x, y, c)
  }
}

/** A filled disc, coloured by a constant or a per-scanline band function. */
function disc(
  canvas: number[],
  cx: number,
  cy: number,
  r: number,
  color: number | ((dy: number) => number),
): void {
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy))
    const c = typeof color === 'function' ? color(dy) : color
    for (let dx = -w; dx <= w; dx++) px(canvas, cx + dx, cy + dy, c)
  }
}

/** A tilted elliptical ring band; `half` limits it to the top or bottom arc. */
function ring(
  canvas: number[],
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  c: number,
  half: 'top' | 'bottom' | 'both' = 'both',
): void {
  for (let x = cx - rx; x <= cx + rx; x++) {
    for (let y = cy - ry - 1; y <= cy + ry + 1; y++) {
      if (half === 'top' && y > cy) continue
      if (half === 'bottom' && y < cy) continue
      const v = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
      if (v > 0.82 && v < 1.0) px(canvas, x, y, c)
    }
  }
}

function fillRect(canvas: number[], x0: number, y0: number, w: number, h: number, c: number): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) px(canvas, x, y, c)
}

/** Blit ASCII art at (x,y); `.`/space = transparent. `map` turns chars→colour. */
function blit(
  canvas: number[],
  art: string[],
  x0: number,
  y0: number,
  map: Record<string, number>,
): void {
  for (let r = 0; r < art.length; r++) {
    const row = art[r]!
    for (let c = 0; c < row.length; c++) {
      const ch = row[c]!
      if (ch === '.' || ch === ' ') continue
      const color = map[ch]
      if (color !== undefined) px(canvas, x0 + c, y0 + r, color)
    }
  }
}

/** Draw text with the bundled 5×7 font (6px advance). */
function drawText(canvas: number[], x0: number, y: number, str: string, c: number): void {
  let x = x0
  for (const ch of str.toUpperCase()) {
    const art = FONT[ch] ?? FONT['?']!
    for (let r = 0; r < art.length; r++) {
      const row = art[r]!
      for (let k = 0; k < row.length; k++) if (row[k] === '#') px(canvas, x + k, y + r, c)
    }
    x += 6
  }
}

// Deterministic pseudo-random starfield (no Math.random, so samples are stable).
function stars(canvas: number[], seed: number, count: number): void {
  let s = seed
  const next = (): number => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
  for (let i = 0; i < count; i++) {
    const x = Math.floor(next() * CANVAS_W)
    const y = Math.floor(next() * CANVAS_H)
    if (canvas[y * CANVAS_W + x] !== 1) continue // only scatter over black space
    px(canvas, x, y, next() < 0.35 ? 14 : 15) // gray or white
  }
}

const SHIP = [
  '.................LL...........',
  '...............LLGGL..........',
  '.....vv.......LGGGGGGL........',
  '...vvww......LGGGGGGGGL.......',
  '.vvwwwww...LGGGccGGGGGGGL.....',
  'ooffwwwwwwGGGGccGGGGGGGGGGL...',
  'ooffGGGGGGGGGGGGGGGGGGGGGGGGLL',
  'ooffGGGGGGGGGGGccGGGGGGGGGGL..',
  '.vvwwwww...LGGGccGGGGGGGL.....',
  '...vvww......LGGGGGGGGL.......',
  '.....vv.......LGGGGGGL........',
  '...............LLGGL..........',
  '.................LL...........',
]
const SHIP_MAP: Record<string, number> = { L: 15, G: 14, c: 7, w: 5, v: 4, o: 8, f: 11 }

const ENEMY = ['...WWW...', '..WmmmW..', '.GGGGGGG.', 'GGcGcGcGG', '.G.G.G.G.']
const ENEMY_MAP: Record<string, number> = { W: 15, m: 13, G: 12, c: 11 }

function spaceSample(): Project {
  const project = createProject({
    name: 'Sample — Star Voyager',
    type: 'graphics2',
    g2CharsetMode: 'independent',
  })
  const canvas = makeCanvas(1) // black space

  // Nebula: a soft glow confined to the upper third, behind the planet, so the
  // rest of the screen stays clean starry black for the ship to fly through.
  hBands(canvas, [
    { to: 14, c: 1 }, // black
    { to: 30, c: 4 }, // dark blue
    { to: 48, c: 13 }, // magenta nebula core
    { to: 66, c: 4 }, // dark blue
    { to: CANVAS_H, c: 1 }, // black space below
  ])
  stars(canvas, 1337, 420)

  // Ringed gas giant, upper-left, banded by scanline like Jupiter.
  const giantBand = (dy: number): number => {
    if (dy < -22) return 11 // light yellow
    if (dy < -10) return 10 // dark yellow
    if (dy < -2) return 8 // medium red
    if (dy < 8) return 11
    if (dy < 18) return 6 // dark red
    return 10
  }
  ring(canvas, 56, 46, 58, 20, 14, 'top') // ring arc behind the planet
  disc(canvas, 56, 46, 38, giantBand)
  ring(canvas, 56, 46, 58, 20, 7, 'bottom') // ring arc in front (cyan)

  // Player fighter, centre-left, firing to the right.
  const shipX = 96
  const shipY = 100
  blit(canvas, SHIP, shipX, shipY, SHIP_MAP)
  // Laser bolt streaking from the nose toward the enemy.
  const boltY = shipY + 6
  fillRect(canvas, shipX + 29, boltY - 1, 96, 1, 11) // yellow edge
  fillRect(canvas, shipX + 29, boltY, 96, 1, 15) // white core
  fillRect(canvas, shipX + 29, boltY + 1, 96, 1, 11) // yellow edge

  // Enemy raider diving in, with the bolt's impact bursting at its base.
  blit(canvas, ENEMY, 220, boltY - 14, ENEMY_MAP)
  disc(canvas, 230, boltY, 7, (dy) => (Math.abs(dy) < 3 ? 11 : Math.abs(dy) < 5 ? 8 : 6))

  // HUD.
  drawText(canvas, 6, 5, 'SCORE 013370', 15)
  drawText(canvas, 190, 5, 'STAGE 3', 7)

  fitCanvasToG2(project, canvas)
  return project
}

// --- Multicolor Mode: a chunky 64×48 block scene + full-palette strip ---

function multicolorSample(): Project {
  const project = createProject({ name: 'Sample — Vista', type: 'multicolor' })
  const { columns: cols, rows } = MODES.multicolor // 64 × 48
  const cells = project.screens[0]!.cells
  const set = (x: number, y: number, c: number) => {
    if (x >= 0 && x < cols && y >= 0 && y < rows) cells[y * cols + x] = c
  }

  const PALETTE_ROWS = 2 // full-colour strip along the bottom
  const grassTop = rows - PALETTE_ROWS

  // Gentle hills — the higher of two triangular ridges sets the horizon.
  const horizon = (x: number) => {
    const back = Math.max(0, 9 - Math.abs(x - 14) * 0.9)
    const front = Math.max(0, 12 - Math.abs(x - 46) * 0.8)
    return Math.round(34 - Math.max(back, front))
  }

  for (let y = 0; y < grassTop; y++) {
    for (let x = 0; x < cols; x++) {
      if (y < horizon(x))
        set(x, y, y < 12 ? 4 : 5) // sky: dark blue → light blue
      else set(x, y, y < grassTop - 4 ? 2 : 12) // grass: medium green → dark green foreground
    }
  }

  // Sun — a light-yellow disc with a dark-yellow rim, drawn over the sky.
  const sunX = 49
  const sunY = 9
  for (let dy = -7; dy <= 7; dy++) {
    for (let dx = -7; dx <= 7; dx++) {
      const d = Math.hypot(dx, dy)
      if (d <= 6) set(sunX + dx, sunY + dy, d <= 4 ? 11 : 10)
    }
  }

  // Clouds — white tops with a grey underside.
  const cloud = (cx: number, cy: number) => {
    for (let x = 0; x < 7; x++) {
      set(cx + x, cy, 15)
      set(cx + x, cy + 1, 14)
    }
    set(cx + 1, cy - 1, 15)
    set(cx + 3, cy - 1, 15)
  }
  cloud(6, 6)
  cloud(24, 4)

  // Full-palette strip: all 16 colours, four blocks wide each (16 × 4 = 64).
  for (let x = 0; x < cols; x++) {
    const color = Math.floor(x / 4)
    for (let y = grassTop; y < rows; y++) set(x, y, color)
  }

  return project
}

// --- Sprite Mode: a 16×16 ship, alien and explosion with three animations ---

/** 16 rows of 16 chars (`#` = pixel on) → a sprite grid. */
function spriteArt(rows: string[]): boolean[][] {
  return Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => (rows[y]?.[x] ?? ' ') === '#'),
  )
}

/**
 * Write one 16×16 sprite into a slot. `gridToPatterns` handles the hardware
 * quadrant order (TL, BL, TR, BR — PLAN.md §14.3), so the art above stays
 * readable as a picture rather than four interleaved eighths.
 */
function putSprite(project: Project, slot: number, rows: string[], color: number): void {
  const base = slotToPattern(slot, 16)
  gridToPatterns(spriteArt(rows), 16).forEach((pattern, i) => {
    project.charsets[0]![base + i] = pattern
  })
  ;(project.colors as SpriteColors).sprites[base] = color
}

/** The ship, minus its exhaust — the top 12 rows are identical in all 3 frames. */
const SHIP_BODY = [
  '       ##       ',
  '      ####      ',
  '      ####      ',
  '     ######     ',
  '     ######     ',
  '    ########    ',
  '    ########    ',
  '   ##########   ',
  '  ############  ',
  ' ############## ',
  '###  ######  ###',
  '##   ######   ##',
]

const THRUSTS = [
  ['      ####      ', '       ##       ', '                ', '                '],
  ['     ######     ', '      ####      ', '       ##       ', '                '],
  ['     ######     ', '     ######     ', '      ####      ', '       ##       '],
]

const ALIEN_BODY = [
  '                ',
  '   #        #   ',
  '    #      #    ',
  '   ##########   ',
  '  ##  ####  ##  ',
  ' ############## ',
  ' ############## ',
  ' ##  ######  ## ',
  ' ##  ######  ## ',
  ' ############## ',
  '  ############  ',
  '   ##########   ',
]

const ALIEN_LEGS = [
  ['   ##      ##   ', '  ##        ##  ', '  #          #  ', '                '],
  ['   ##      ##   ', '   ##      ##   ', '    ##    ##    ', '     #    #     '],
]

const EXPLOSION = [
  [
    '                ',
    '                ',
    '                ',
    '                ',
    '                ',
    '                ',
    '       ##       ',
    '      ####      ',
    '      ####      ',
    '       ##       ',
  ],
  [
    '                ',
    '                ',
    '                ',
    '                ',
    '       ##       ',
    '   #  ####  #   ',
    '    ########    ',
    '  ############  ',
    '  ############  ',
    '    ########    ',
    '   #  ####  #   ',
    '       ##       ',
  ],
  [
    '                ',
    '                ',
    '      #  #      ',
    '   #  ####  #   ',
    '  # ######## #  ',
    ' ############## ',
    '  ############  ',
    '###  ######  ###',
    '###  ######  ###',
    '  ############  ',
    ' ############## ',
    '  # ######## #  ',
    '   #  ####  #   ',
    '      #  #      ',
  ],
  [
    '                ',
    '  #          #  ',
    '     #    #     ',
    '                ',
    ' #    #  #    # ',
    '                ',
    '   #        #   ',
    '                ',
    '                ',
    '   #        #   ',
    '                ',
    ' #    #  #    # ',
    '                ',
    '     #    #     ',
    '  #          #  ',
  ],
]

function spriteSample(): Project {
  const project = createProject({ name: 'Sample — Astro Ace', type: 'sprite', spriteSize: 16 })

  // Slots 0–2: the ship, one per exhaust length. Cyan.
  THRUSTS.forEach((thrust, i) => putSprite(project, i, [...SHIP_BODY, ...thrust], 7))

  // Slots 3–4: the alien's two leg poses. Medium green.
  ALIEN_LEGS.forEach((legs, i) => putSprite(project, 3 + i, [...ALIEN_BODY, ...legs], 2))

  // Slots 5–8: the explosion, cooling from light yellow through to dark red.
  // Colour lives per sprite slot, so a frame sequence can change colour even
  // though any single sprite is one solid colour (PLAN.md Decision 27).
  const BURN = [11, 10, 8, 6]
  EXPLOSION.forEach((frame, i) => putSprite(project, 5 + i, frame, BURN[i] ?? 15))

  project.settings.backdrop = 1 // black — space
  project.animations = [
    { name: 'Thrust', frames: [0, 1, 2, 1], fps: 12 },
    { name: 'Alien Walk', frames: [3, 4], fps: 6 },
    { name: 'Explosion', frames: [5, 6, 7, 8], fps: 12 },
  ]
  return project
}

export const SAMPLES: Sample[] = [
  {
    id: 'text-greeting',
    name: 'Text Greeting',
    description: 'Text Mode · a 5×7 font spelling TMS9918 EDITOR',
    build: textSample,
  },
  {
    id: 'platform-climb',
    name: 'Platform Climb',
    description: 'Graphics I · an arcade platformer — one flat colour per tile type',
    build: platformSample,
  },
  {
    id: 'star-voyager',
    name: 'Star Voyager',
    description: 'Graphics II · a full-screen bitmap space battle (per-row colours, 3 charsets)',
    build: spaceSample,
  },
  {
    id: 'vista',
    name: 'Vista',
    description: 'Multicolor · a 64×48 block scene + full-palette strip',
    build: multicolorSample,
  },
  {
    id: 'astro-ace',
    name: 'Astro Ace',
    description: 'Sprite · a 16×16 ship, alien and explosion with three animations',
    build: spriteSample,
  },
]
