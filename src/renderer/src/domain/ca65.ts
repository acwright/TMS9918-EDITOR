/**
 * ca65 assembler output formatting.
 */

import type { CharPattern } from './types'

function hexByte(value: number): string {
  return '$' + value.toString(16).toUpperCase().padStart(2, '0')
}

/** Format a character's pattern bytes as a ca65 `.byte` directive. */
export function formatCharBytes(pattern: CharPattern): string {
  return '.byte ' + pattern.map(hexByte).join(', ')
}
