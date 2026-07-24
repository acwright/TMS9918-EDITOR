/**
 * Raw binary output — the selected segments concatenated in order into a
 * single byte array (the interchange format other tools, incl. Magellan,
 * import). Labels are dropped; only the bytes remain.
 */

import type { ByteSegment } from './tables'

/** Concatenate all segment bytes into one `Uint8Array`. */
export function segmentsToBinary(segments: ByteSegment[]): Uint8Array {
  const total = segments.reduce((sum, seg) => sum + seg.bytes.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const seg of segments) {
    out.set(seg.bytes, offset)
    offset += seg.bytes.length
  }
  return out
}
