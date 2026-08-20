import { describe, expect, it } from 'vitest'
import { createProject } from '../factory'
import { ProjectValidationError } from '../serialization'
import {
  ShareLinkError,
  decodeShare,
  encodeShare,
  readShareHash,
  shareUrl,
} from '../share'
import { isGraphics2Colors } from '../types'
import { PROJECT_TYPES } from '../modes'

describe('share links', () => {
  it.each(PROJECT_TYPES)('round-trips a %s project', async (type) => {
    const project = createProject({ name: `Share ${type}`, type })
    if (type === 'sprite') {
      // Sprite projects have no screen; their payload is patterns + animations.
      project.charsets[0]![0] = [0x3c, 0x42, 0x81, 0xa5, 0x81, 0x99, 0x42, 0x3c]
      project.animations = [{ name: 'Blink', frames: [0, 1, 0], fps: 6 }]
    } else {
      project.screens[0]!.cells[10] = type === 'multicolor' ? 7 : 65
    }
    const decoded = await decodeShare(await encodeShare(project))
    expect(decoded).toEqual(project)
  })

  it('compresses gzip-scheme payloads well below the raw JSON size', async () => {
    const project = createProject({
      name: 'Heavy',
      type: 'graphics2',
      g2CharsetMode: 'independent',
    })
    // A worst case for size: three charsets, a per-row colour table, 4 screens.
    for (const charset of project.charsets) {
      charset.forEach((pattern, i) => pattern.fill(i & 0xff))
    }
    if (!isGraphics2Colors(project.colors)) throw new Error('expected g2 colors')
    for (const set of project.colors.rows) {
      for (const char of set) char.forEach((pair) => ((pair.fg = 15), (pair.bg = 4)))
    }
    for (let i = 1; i < 4; i++) {
      project.screens.push({ name: `Screen ${i + 1}`, cells: project.screens[0]!.cells.slice() })
    }

    const payload = await encodeShare(project)
    expect(payload.startsWith('1')).toBe(true) // gzip scheme
    expect(payload.length).toBeLessThan(JSON.stringify(project).length / 10)
    expect(await decodeShare(payload)).toEqual(project)
  })

  it('reads the payload out of a location hash', () => {
    expect(readShareHash('#p=1abc')).toBe('1abc')
    expect(readShareHash('#')).toBeNull()
    expect(readShareHash('')).toBeNull()
    expect(readShareHash('#other=1')).toBeNull()
  })

  it('builds an absolute URL rooted at the app base', async () => {
    const url = shareUrl('1abc')
    expect(url.startsWith(window.location.origin)).toBe(true)
    expect(url.endsWith('#p=1abc')).toBe(true)
    expect(readShareHash(new URL(url).hash)).toBe('1abc')
  })

  it('rejects payloads with no scheme, an unknown scheme, or nothing after it', async () => {
    for (const bad of ['', '1', '9abcdef', 'abcdef']) {
      await expect(decodeShare(bad)).rejects.toBeInstanceOf(ShareLinkError)
    }
  })

  it('rejects a truncated payload rather than half-loading it', async () => {
    const payload = await encodeShare(createProject({ name: 'Trunc', type: 'text' }))
    await expect(decodeShare(payload.slice(0, payload.length - 12))).rejects.toBeInstanceOf(
      ShareLinkError,
    )
  })

  it('reads a plain-scheme payload for browsers without Compression Streams', async () => {
    const project = createProject({ name: 'Plain', type: 'text' })
    const json = JSON.stringify(project)
    const bytes = new TextEncoder().encode(json)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    const payload = '0' + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(await decodeShare(payload)).toEqual(project)
  })

  it('surfaces schema problems with the normal validation message', async () => {
    const project = createProject({ name: 'Bad', type: 'text' })
    project.screens[0]!.cells.pop()
    await expect(decodeShare(await encodeShare(project))).rejects.toBeInstanceOf(
      ProjectValidationError,
    )
  })
})
