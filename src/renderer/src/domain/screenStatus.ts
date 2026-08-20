/**
 * Screen pointer status (PLAN.md §12 Decisions 15–16) — the read-only line
 * under the screen canvas. Pure: given the project, the screen, and the cell
 * the pointer is over (null when it isn't), produce the strings to display.
 */

import { MODES, COLOR_GROUP_SIZE } from './modes'
import { PALETTE } from './palette'
import type { Project, Screen } from './types'

export interface PointerCell {
  x: number
  y: number
}

export interface ScreenStatus {
  /** False when the pointer is off the canvas — the idle (dimensions) form. */
  active: boolean
  /** Cell coordinates, or the screen's size in cells when idle. */
  coords: string
  /** Top-left pixel of the cell, or the screen's size in pixels when idle. */
  pixel: string
  /** Mode-relevant facts about the cell under the pointer; empty when idle. */
  details: string[]
}

function hex(value: number): string {
  return '$' + value.toString(16).toUpperCase().padStart(2, '0')
}

/** Status for the cell under the pointer; pass `null` for the idle readout. */
export function screenStatus(
  project: Project,
  screen: Screen | null | undefined,
  cell: PointerCell | null,
): ScreenStatus {
  const mode = MODES[project.type]
  const inBounds =
    cell !== null && cell.x >= 0 && cell.x < mode.columns && cell.y >= 0 && cell.y < mode.rows

  if (!cell || !inBounds) {
    return {
      active: false,
      coords: `${mode.columns} × ${mode.rows} ${project.type === 'multicolor' ? 'blocks' : 'cells'}`,
      pixel: `${mode.columns * mode.cellWidth} × ${mode.rows * mode.cellHeight} px`,
      details: [],
    }
  }

  const value = screen?.cells[cell.y * mode.columns + cell.x] ?? 0
  const details: string[] = []

  if (project.type === 'multicolor') {
    details.push(`colour ${value} (${PALETTE[value]?.name ?? 'unknown'})`)
  } else {
    details.push(`char ${hex(value)} (${value})`)
    if (project.type === 'graphics1') {
      details.push(`group ${Math.floor(value / COLOR_GROUP_SIZE)}`)
    } else if (project.type === 'graphics2') {
      // Screen thirds map to charsets 1–3 when independent, and are still the
      // useful landmark when mirrored.
      const third = Math.floor(cell.y / 8) + 1
      details.push(
        project.settings.g2CharsetMode === 'independent' ? `set ${third}` : `third ${third}`,
      )
    }
  }

  return {
    active: true,
    coords: `X ${cell.x}  Y ${cell.y}`,
    pixel: `px ${cell.x * mode.cellWidth}, ${cell.y * mode.cellHeight}`,
    details,
  }
}

/** One-line rendering of a status, for the panel's status bar. */
export function formatScreenStatus(status: ScreenStatus): string {
  return [status.coords, status.pixel, ...status.details].join('  ·  ')
}
