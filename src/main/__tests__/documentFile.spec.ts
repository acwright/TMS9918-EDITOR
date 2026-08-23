import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * The file mechanics behind the open document (PLAN.md D6), in the node vitest
 * project — the renderer's suite runs in jsdom and cannot reach `src/main`.
 *
 * What is covered here is what a run of the app is bad at showing: that the
 * write really is atomic, that a failed write leaves nothing behind, and that
 * the two extensions a document can arrive under both come back with the right
 * name. The dialogs and the IPC wiring are verified by driving the app.
 *
 * `documentFile.ts` imports no Electron, which is what lets this run straight
 * rather than behind a mock of it.
 */

import {
  documentFileName,
  documentName,
  isDocumentPath,
  readDocumentAt,
  resolveDocumentPath,
  stampOf,
  writeDocumentAt,
} from '../documentFile'

let directory: string


beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'tms9918-document-'))
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

describe('documentName', () => {
  it('takes the extension off the name a document is written under', () => {
    expect(documentName('/projects/Star Voyager.tms9918')).toBe('Star Voyager')
  })

  // The compound name has to be tried first, or this comes back as
  // "Star Voyager.tms9918" — the wrong half stripped (D3).
  it('takes the whole compound extension off a v1 export', () => {
    expect(documentName('/projects/Star Voyager.tms9918.json')).toBe('Star Voyager')
  })

  it('is case-insensitive about the extension', () => {
    expect(documentName('/projects/Star Voyager.TMS9918')).toBe('Star Voyager')
  })

  it('drops the last extension of anything else', () => {
    expect(documentName('/projects/notes.txt')).toBe('notes')
    expect(documentName('/projects/README')).toBe('README')
  })

  it('keeps the dots inside a name', () => {
    expect(documentName('/projects/v1.2 charset.tms9918')).toBe('v1.2 charset')
  })
})

describe('documentFileName', () => {
  it('keeps the name the user typed, spaces and all', () => {
    expect(documentFileName('Star Voyager')).toBe('Star Voyager.tms9918')
  })

  it('replaces only what a filesystem refuses', () => {
    expect(documentFileName('Level 1/2: "final"')).toBe('Level 1 2 final.tms9918')
    expect(documentFileName('a\\b|c?d*e')).toBe('a b c d e.tms9918')
  })

  it('never produces a hidden file, a trailing dot or a bare extension', () => {
    expect(documentFileName('.hidden')).toBe('hidden.tms9918')
    expect(documentFileName('trailing.')).toBe('trailing.tms9918')
    expect(documentFileName('   ')).toBe('Project.tms9918')
    expect(documentFileName('')).toBe('Project.tms9918')
  })
})

describe('writeDocumentAt', () => {
  it('writes the text and answers with the file’s stamp', () => {
    const path = join(directory, 'Alpha.tms9918')
    const stamp = writeDocumentAt(path, 'hello\n')

    expect(readFileSync(path, 'utf-8')).toBe('hello\n')
    expect(stamp).toEqual(stampOf(path))
    expect(stamp.size).toBe(6)
  })

  it('leaves no temporary file beside the document', () => {
    const path = join(directory, 'Alpha.tms9918')
    writeDocumentAt(path, 'hello\n')
    expect(readdirSync(directory)).toEqual(['Alpha.tms9918'])
  })

  it('replaces the previous contents rather than appending to them', () => {
    const path = join(directory, 'Alpha.tms9918')
    writeDocumentAt(path, 'first\n')
    writeDocumentAt(path, 'second\n')
    expect(readFileSync(path, 'utf-8')).toBe('second\n')
  })

  it("returns the file's own stamp for a same-length rewrite", () => {
    // What this can assert, and what it deliberately does not.
    //
    // D5 elides a write that would change nothing and D6's guard compares
    // stamps, so both would like mtime to separate two same-length writes.
    // **Whether it does is the filesystem's business, not this code's**, and
    // it is not universal: S3 measured six back-to-back writes producing six
    // distinct mtimes on APFS, and the CI runner gives two *write-temp-then-
    // rename* cycles the same mtime — even though two in-place writes there
    // do separate. So distinctness is a measurement, recorded in PLAN.md §6,
    // and not an assertion; a test that made it would be testing the runner.
    //
    // The narrow consequence where it does not hold: a `{ mtimeMs, size }`
    // stamp cannot tell apart a same-length file swapped in within the same
    // tick as our own last write. PLAN.md §12 carries the fix — a content
    // hash — as deferred work.
    //
    // What *is* this code's business, and is asserted: the stamp handed back
    // is the file's own rather than a cached guess, the size is the new
    // text's, mtime never goes backwards, and the bytes really changed.
    const path = join(directory, 'Alpha.tms9918')
    const first = writeDocumentAt(path, 'aaaa\n')
    const second = writeDocumentAt(path, 'bbbb\n')

    expect(second).toEqual(stampOf(path))
    expect(second.size).toBe(first.size)
    expect(second.mtimeMs).toBeGreaterThanOrEqual(first.mtimeMs)
    expect(readFileSync(path, 'utf-8')).toBe('bbbb\n')
  })

  it('leaves the existing document intact when the write fails', () => {
    // A directory where the temporary file wants to be: `writeFileSync` throws
    // EISDIR, and the rename never happens. This is the property the whole
    // temp-then-rename dance exists for.
    const path = join(directory, 'Alpha.tms9918')
    writeDocumentAt(path, 'an evening of work\n')
    mkdirSync(`${path}.tmp`)

    expect(() => writeDocumentAt(path, 'clobbered')).toThrow(/EISDIR|illegal operation/)
    expect(readFileSync(path, 'utf-8')).toBe('an evening of work\n')
  })

  it('cleans up the temporary file when the rename fails', () => {
    // The temporary is written, then `rename` refuses because the target is a
    // directory. Nothing may be left lying next to the user's projects.
    const path = join(directory, 'Alpha.tms9918')
    mkdirSync(path)

    expect(() => writeDocumentAt(path, 'text')).toThrow(/EISDIR|ENOTEMPTY|illegal operation/)
    expect(readdirSync(directory)).toEqual(['Alpha.tms9918'])
  })
})

describe('readDocumentAt', () => {
  it('answers with the text, the name and a stamp', () => {
    const path = join(directory, 'Star Voyager.tms9918')
    writeFileSync(path, '{}\n', 'utf-8')

    expect(readDocumentAt(path)).toEqual({
      path,
      name: 'Star Voyager',
      text: '{}\n',
      stamp: stampOf(path),
    })
  })

  it('reads a v1 export under its compound name', () => {
    const path = join(directory, 'Star Voyager.tms9918.json')
    writeFileSync(path, '{}\n', 'utf-8')
    expect(readDocumentAt(path).name).toBe('Star Voyager')
  })

  it('throws rather than answering with an empty document', () => {
    expect(() => readDocumentAt(join(directory, 'missing.tms9918'))).toThrow(/ENOENT/)
  })

  it('round-trips what writeDocumentAt wrote', () => {
    const path = join(directory, 'Alpha.tms9918')
    const text = '{\n  "id": "abc"\n}\n'
    writeDocumentAt(path, text)
    expect(readDocumentAt(path).text).toBe(text)
  })
})

describe('isDocumentPath', () => {
  it('recognises the name documents are written under, and the v1 one (D3)', () => {
    expect(isDocumentPath('/projects/Star Voyager.tms9918')).toBe(true)
    expect(isDocumentPath('/projects/Star Voyager.tms9918.json')).toBe(true)
    expect(isDocumentPath('/projects/STAR VOYAGER.TMS9918')).toBe(true)
  })

  // What this keeps out of `documentFromArgv`: Electron's own switches, the
  // `.` electron-vite passes in development, and a flag's value.
  it('refuses anything else', () => {
    expect(isDocumentPath('.')).toBe(false)
    expect(isDocumentPath('/projects/notes.json')).toBe(false)
    expect(isDocumentPath('--remote-debugging-port=9222')).toBe(false)
  })
})

describe('resolveDocumentPath', () => {
  it('answers with an absolute path for a file that is there', () => {
    const path = join(directory, 'Alpha.tms9918')
    writeFileSync(path, '{}\n', 'utf-8')
    // The directory itself may be a symlink (/tmp is one on macOS), which is
    // exactly what this resolves — so it is compared against the same answer
    // rather than against the path that went in (S1).
    expect(resolveDocumentPath(path)).toBe(realpathSync(path))
  })

  it('answers null for a path that is not there', () => {
    expect(resolveDocumentPath(join(directory, 'missing.tms9918'))).toBeNull()
  })
})
