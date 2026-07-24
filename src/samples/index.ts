/**
 * Bundled sample projects — one per mode — loadable from the project manager.
 * Each builder returns a fresh Project (new id + timestamps) so loading a
 * sample twice makes two independent projects.
 *
 * Characters are authored as ASCII art (`#` = pixel on, MSB = leftmost),
 * which keeps the pixel data readable and easy to tweak.
 */

import type { Graphics1Colors, Graphics2Colors, Project } from '@/domain/types'
import { createProject } from '@/domain/factory'
import { MODES } from '@/domain/modes'
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

// --- Graphics Mode I: a banded landscape (color per 8-char group) ---

function landscapeSample(): Project {
  const project = createProject({ name: 'Sample — Landscape', type: 'graphics1' })
  const charset = project.charsets[0]
  const colors = project.colors as Graphics1Colors
  if (!charset) return project

  const SOLID = glyph(['########', '########', '########', '########', '########', '########', '########', '########']) // prettier-ignore

  charset[1] = glyph([
    '..####..',
    '.######.',
    '########',
    '########',
    '########',
    '########',
    '.######.',
    '..####..',
  ]) // sun
  charset[8] = SOLID // sky
  charset[16] = glyph([
    '........',
    '........',
    '....##..',
    '..#####.',
    '.#######',
    '########',
    '########',
    '########',
  ]) // hill
  charset[24] = SOLID // grass
  charset[32] = glyph([
    '...##...',
    '..####..',
    '.######.',
    '########',
    '........',
    '........',
    '........',
    '........',
  ]) // cloud

  // One fg/bg pair per group of 8 characters (the charset-picker half-row)
  colors.groups[0] = { fg: 10, bg: 5 } // sun: dark yellow on sky blue
  colors.groups[1] = { fg: 5, bg: 1 } // sky: light blue
  colors.groups[2] = { fg: 12, bg: 5 } // hills: dark green on sky
  colors.groups[3] = { fg: 2, bg: 1 } // grass: medium green
  colors.groups[4] = { fg: 15, bg: 5 } // clouds: white on sky

  const { columns } = MODES.graphics1
  for (let y = 0; y < 11; y++) for (let x = 0; x < columns; x++) place(project, x, y, 8) // sky
  for (let x = 0; x < columns; x++) place(project, x, 11, 16) // hill ridge
  for (let y = 12; y < 24; y++) for (let x = 0; x < columns; x++) place(project, x, y, 24) // grass
  place(project, 26, 1, 1) // sun
  place(project, 4, 2, 32) // clouds
  place(project, 12, 1, 32)
  place(project, 20, 3, 32)
  return project
}

// --- Graphics Mode II: multicolor icons (color per pixel row) ---

interface RowSpec {
  pat: number
  fg: number
  bg: number
}

function setG2Char(project: Project, code: number, spec: RowSpec[]): void {
  const charset = project.charsets[0]
  const colors = project.colors as Graphics2Colors
  if (charset) charset[code] = spec.map((s) => s.pat)
  const rows = colors.rows[0]
  if (rows) rows[code] = spec.map((s) => ({ fg: s.fg, bg: s.bg }))
}

function iconsSample(): Project {
  const project = createProject({ name: 'Sample — Icons', type: 'graphics2' })

  // Smiley: yellow face (silhouette rows use transparent bg for round edges;
  // feature rows are full-width, so bg can be the face color)
  setG2Char(project, 1, [
    { pat: 0b00111100, fg: 10, bg: 0 },
    { pat: 0b01111110, fg: 10, bg: 0 },
    { pat: 0b00100100, fg: 1, bg: 10 }, // eyes
    { pat: 0b00000000, fg: 1, bg: 10 },
    { pat: 0b01000010, fg: 1, bg: 10 }, // mouth corners
    { pat: 0b00111100, fg: 1, bg: 10 }, // mouth base
    { pat: 0b01111110, fg: 10, bg: 0 },
    { pat: 0b00111100, fg: 10, bg: 0 },
  ])

  // Heart: light-red top fading to medium-red — a per-row gradient
  setG2Char(project, 2, [
    { pat: 0b01100110, fg: 9, bg: 0 },
    { pat: 0b11111111, fg: 9, bg: 0 },
    { pat: 0b11111111, fg: 8, bg: 0 },
    { pat: 0b11111111, fg: 8, bg: 0 },
    { pat: 0b01111110, fg: 8, bg: 0 },
    { pat: 0b00111100, fg: 8, bg: 0 },
    { pat: 0b00011000, fg: 8, bg: 0 },
    { pat: 0b00000000, fg: 8, bg: 0 },
  ])

  const { columns, rows } = MODES.graphics2
  for (let y = 1; y < rows - 1; y += 2) {
    for (let x = 1; x < columns - 1; x += 2) {
      place(project, x, y, ((x + y) / 2) % 2 === 0 ? 1 : 2)
    }
  }
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
      if (y < horizon(x)) set(x, y, y < 12 ? 4 : 5) // sky: dark blue → light blue
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

export const SAMPLES: Sample[] = [
  {
    id: 'text-greeting',
    name: 'Text Greeting',
    description: 'Text Mode · a 5×7 font spelling TMS9918 EDITOR',
    build: textSample,
  },
  {
    id: 'landscape',
    name: 'Landscape',
    description: 'Graphics I · banded scene showing per-group colors',
    build: landscapeSample,
  },
  {
    id: 'icons',
    name: 'Icons',
    description: 'Graphics II · multicolor smiley + heart (per-row colors)',
    build: iconsSample,
  },
  {
    id: 'vista',
    name: 'Vista',
    description: 'Multicolor · a 64×48 block scene + full-palette strip',
    build: multicolorSample,
  },
]
