/**
 * Assembler output. One builder parameterized by processor dialect:
 *   - 6502 — ca65 (cc65) syntax: `.byte $XX, …`
 *   - Z80  — `db $XX, …` (WLA-DX / sjasmplus / tniasm — MSX, ColecoVision, SG-1000)
 * Labels sit at column 0; data lines are indented so col-0-label assemblers
 * (common on Z80) don't misparse the directive.
 */

import type { ByteSegment } from './tables'
import { applyLabelCase, DEFAULT_LABEL_CASE, type LabelCase } from './labels'

export type AsmDialectId = 'ca65' | 'z80'

export interface AsmDialect {
  id: AsmDialectId
  /** Header-comment name identifying the target. */
  label: string
  directive: string
}

export const ASM_DIALECTS: Record<AsmDialectId, AsmDialect> = {
  ca65: { id: 'ca65', label: '6502 assembly (ca65)', directive: '.byte' },
  z80: { id: 'z80', label: 'Z80 assembly', directive: 'db' },
}

const INDENT = '    '

function hex(byte: number): string {
  return '$' + byte.toString(16).toUpperCase().padStart(2, '0')
}

export interface AsmOptions {
  /** Casing applied to the segments' canonical snake_case labels. */
  labelCase: LabelCase
}

/** Render labelled byte segments as assembler source for `dialect`. */
export function segmentsToAsm(
  segments: ByteSegment[],
  dialect: AsmDialect,
  title: string,
  options: AsmOptions = { labelCase: DEFAULT_LABEL_CASE },
): string {
  const lines: string[] = [`; ${title}`, `; ${dialect.label} — exported from TMS9918 Editor`, '']
  for (const seg of segments) {
    lines.push(`; ${seg.description} — ${seg.bytes.length} bytes`)
    lines.push(`${applyLabelCase(seg.label, options.labelCase)}:`)
    for (let i = 0; i < seg.bytes.length; i += seg.perLine) {
      const row = seg.bytes
        .slice(i, i + seg.perLine)
        .map(hex)
        .join(', ')
      lines.push(`${INDENT}${dialect.directive} ${row}`)
    }
    lines.push('')
  }
  return lines.join('\n').trimEnd() + '\n'
}
