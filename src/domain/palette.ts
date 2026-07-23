/**
 * TMS9918 palette — 15 colors + transparent (PLAN.md §4.1).
 * `hex` is null for transparent; it renders as a checkerboard swatch and as
 * the app's neutral background on screen.
 */

export interface PaletteEntry {
  index: number
  name: string
  hex: string | null
}

export const TRANSPARENT = 0

export const PALETTE: readonly PaletteEntry[] = [
  { index: 0, name: 'Transparent', hex: null },
  { index: 1, name: 'Black', hex: '#000000' },
  { index: 2, name: 'Medium Green', hex: '#3EB849' },
  { index: 3, name: 'Light Green', hex: '#74D07D' },
  { index: 4, name: 'Dark Blue', hex: '#5955E0' },
  { index: 5, name: 'Light Blue', hex: '#8076F1' },
  { index: 6, name: 'Dark Red', hex: '#B95E51' },
  { index: 7, name: 'Cyan', hex: '#65DBEF' },
  { index: 8, name: 'Medium Red', hex: '#FF6E63' },
  { index: 9, name: 'Light Red', hex: '#FF897D' },
  { index: 10, name: 'Dark Yellow', hex: '#CCC35E' },
  { index: 11, name: 'Light Yellow', hex: '#DED087' },
  { index: 12, name: 'Dark Green', hex: '#3AA241' },
  { index: 13, name: 'Magenta', hex: '#B766B5' },
  { index: 14, name: 'Gray', hex: '#CCCCCC' },
  { index: 15, name: 'White', hex: '#FFFFFF' },
]

export const PALETTE_SIZE = PALETTE.length

export function isValidColorIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < PALETTE_SIZE
}
