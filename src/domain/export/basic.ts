/**
 * BASIC `DATA` output — decimal bytes on numbered lines, for TI/MSX BASIC.
 * Each segment is introduced by a `REM`; line numbers run from `startLine`
 * by `step`.
 */

import type { ByteSegment } from './tables'

export interface BasicOptions {
  startLine: number
  step: number
}

export const DEFAULT_BASIC_OPTIONS: BasicOptions = { startLine: 1000, step: 10 }

/** Render labelled byte segments as numbered BASIC `DATA`/`REM` lines. */
export function segmentsToBasic(
  segments: ByteSegment[],
  options: BasicOptions,
  title: string,
): string {
  const step = Math.max(1, Math.floor(options.step))
  let line = Math.max(0, Math.floor(options.startLine))
  const out: string[] = []
  const emit = (text: string) => {
    out.push(`${line} ${text}`)
    line += step
  }

  emit(`REM ${title.toUpperCase()}`)
  for (const seg of segments) {
    emit(`REM ${seg.description.toUpperCase()}`)
    for (let i = 0; i < seg.bytes.length; i += seg.perLine) {
      emit(`DATA ${seg.bytes.slice(i, i + seg.perLine).join(',')}`)
    }
  }
  return out.join('\n') + '\n'
}
