import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  EDITOR_SHORTCUTS,
  GROUP_IDS,
  LIST_SHORTCUTS,
  MANAGER_SHORTCUTS,
  describeShortcut,
  keyLabel,
  keyLabels,
  keyText,
  matchEditorShortcut,
  matchManagerShortcut,
  parseKey,
  shortcutLabel,
  shortcutSections,
} from '../shortcuts'

/** A keydown with the modifiers left off unless asked for. */
function press(key: string, modifiers: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key, ...modifiers })
}

describe('parseKey', () => {
  it('splits modifiers off the key', () => {
    expect(parseKey('Shift+Mod+Z')).toEqual({ shift: true, mod: true, alt: false, key: 'Z' })
    expect(parseKey('Alt+ArrowLeft')).toEqual({
      shift: false,
      mod: false,
      alt: true,
      key: 'ArrowLeft',
    })
  })

  it('treats a lone + as a key, not a joiner', () => {
    expect(parseKey('+')).toEqual({ shift: false, mod: false, alt: false, key: '+' })
  })
})

describe('matchEditorShortcut', () => {
  it('matches Ctrl and Cmd alike', () => {
    expect(matchEditorShortcut(press('z', { ctrlKey: true }), 'graphics1')).toBe('undo')
    expect(matchEditorShortcut(press('z', { metaKey: true }), 'graphics1')).toBe('undo')
  })

  it('separates undo from redo by Shift', () => {
    expect(matchEditorShortcut(press('z', { metaKey: true, shiftKey: true }), 'text')).toBe('redo')
  })

  it('separates the two rotations by Shift', () => {
    expect(matchEditorShortcut(press('r'), 'text')).toBe('rotateRight')
    expect(matchEditorShortcut(press('R', { shiftKey: true }), 'text')).toBe('rotateLeft')
  })

  it('ignores a modifier the shortcut does not carry', () => {
    // Ctrl+G is the browser's find-again, not the grid toggle
    expect(matchEditorShortcut(press('g', { ctrlKey: true }), 'graphics1')).toBeNull()
    expect(matchEditorShortcut(press('g'), 'graphics1')).toBe('toggleGrid')
  })

  it('reads Alt+arrows as pattern shifts and bare arrows as nothing', () => {
    expect(matchEditorShortcut(press('ArrowLeft', { altKey: true }), 'text')).toBe('shiftLeft')
    // Bare arrows belong to whichever list has focus
    expect(matchEditorShortcut(press('ArrowLeft'), 'text')).toBeNull()
  })

  it('takes punctuation whatever Shift is doing, since the key already reflects it', () => {
    expect(matchEditorShortcut(press('?', { shiftKey: true }), 'text')).toBe('help')
    expect(matchEditorShortcut(press('+', { shiftKey: true }), 'text')).toBe('zoomIn')
    expect(matchEditorShortcut(press('='), 'text')).toBe('zoomIn')
  })

  it('does not answer to the manager’s keys', () => {
    expect(matchEditorShortcut(press('n'), 'graphics1')).toBeNull()
    expect(matchManagerShortcut(press('n'))).toBe('newProject')
    expect(matchManagerShortcut(press('g'))).toBeNull()
  })

  describe('by mode', () => {
    it('gives Space to sprite projects only, so a focused button keeps it elsewhere', () => {
      expect(matchEditorShortcut(press(' '), 'sprite')).toBe('playPause')
      expect(matchEditorShortcut(press(' '), 'graphics2')).toBeNull()
    })

    it('drops the grid overlay in sprite projects, which have no screen', () => {
      expect(matchEditorShortcut(press('g'), 'sprite')).toBeNull()
    })

    it('keeps the paging and pattern keys in sprite projects, where they mean sprites', () => {
      expect(matchEditorShortcut(press('['), 'sprite')).toBe('prevChar')
      expect(matchEditorShortcut(press(','), 'sprite')).toBe('prevScreen')
      expect(matchEditorShortcut(press('f'), 'sprite')).toBe('fill')
    })

    it('drops the pattern keys in multicolor, which has no character panel', () => {
      expect(matchEditorShortcut(press('f'), 'multicolor')).toBeNull()
      expect(matchEditorShortcut(press('['), 'multicolor')).toBeNull()
      expect(matchEditorShortcut(press('g'), 'multicolor')).toBe('toggleGrid')
    })

    it('matches everything when no mode is given', () => {
      expect(matchEditorShortcut(press('f'))).toBe('fill')
      expect(matchEditorShortcut(press(' '))).toBe('playPause')
    })
  })
})

describe('the map itself', () => {
  const all = [...EDITOR_SHORTCUTS, ...MANAGER_SHORTCUTS, ...LIST_SHORTCUTS]

  it('binds every key to exactly one action per scope', () => {
    for (const list of [EDITOR_SHORTCUTS, MANAGER_SHORTCUTS]) {
      const seen = new Set<string>()
      for (const shortcut of list) {
        for (const key of shortcut.keys) {
          expect(seen.has(key), `${key} is bound twice`).toBe(false)
          seen.add(key)
        }
      }
    }
  })

  it('puts every shortcut in a known section', () => {
    for (const shortcut of all) expect(GROUP_IDS).toContain(shortcut.group)
  })

  it('lists every shortcut exactly once across the sections', () => {
    const listed = shortcutSections().flatMap((section) => section.shortcuts)
    expect(listed).toHaveLength(all.length)
  })
})

describe('shortcutSections', () => {
  const titles = (type: Parameters<typeof shortcutSections>[0]) =>
    shortcutSections(type).map((section) => section.title)

  it('names the pattern and paging sections for the open mode', () => {
    expect(titles('graphics1')).toContain('Character')
    expect(titles('graphics1')).toContain('Screen')
    expect(titles('sprite')).toContain('Sprite')
    expect(titles('sprite')).toContain('Animation')
  })

  it('drops the sections a mode has nothing to put in them', () => {
    // Sprite projects have no screen and no character set list
    expect(titles('sprite')).not.toContain('Character set list')
    // Multicolor paints colours straight onto the screen
    expect(titles('multicolor')).not.toContain('Character')
    expect(titles('multicolor')).not.toContain('Character set list')
  })

  it('re-words the keys that mean something else in a sprite project', () => {
    const paging = EDITOR_SHORTCUTS.find((entry) => entry.action === 'nextScreen')!
    expect(describeShortcut(paging, 'graphics1')).toBe('Next screen')
    expect(describeShortcut(paging, 'sprite')).toBe('Next animation')
  })
})

describe('labels', () => {
  it('spells modifiers out for this platform (jsdom is not a Mac)', () => {
    expect(keyLabel('Mod+Z')).toBe('Ctrl+Z')
    expect(keyLabel('Shift+Mod+Z')).toBe('Shift+Ctrl+Z')
    expect(keyLabel('Alt+ArrowLeft')).toBe('Alt+←')
    expect(keyLabel('Escape')).toBe('Esc')
    expect(shortcutLabel('undo')).toBe('Ctrl+Z')
  })

  it('lists every key of a shortcut for the help dialog', () => {
    const zoomIn = EDITOR_SHORTCUTS.find((entry) => entry.action === 'zoomIn')!
    expect(keyLabels(zoomIn)).toEqual(['+', '='])
  })

  it('uses the Apple glyphs on a Mac', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' })
    vi.resetModules()
    const mac = await import('../shortcuts')
    expect(mac.keyLabel('Shift+Mod+Z')).toBe('⇧⌘Z')
    expect(mac.keyLabel('Alt+ArrowLeft')).toBe('⌥←')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('names both platforms in the form the README uses', () => {
    expect(keyText('Mod+Z')).toBe('Ctrl/Cmd+Z')
    expect(keyText('Shift+Mod+Z')).toBe('Shift+Ctrl/Cmd+Z')
    expect(keyText('Alt+ArrowUp')).toBe('Alt+↑')
  })
})

/**
 * The map is only documented if something checks it. Each shortcut owns one
 * README row, written in the platform-neutral spelling — and a further row for
 * each wording the key takes elsewhere: the sprite-mode one where it means
 * something else there, and the desktop one where it acts on a document rather
 * than on a list (D14). A key added to the map without a line in the README
 * fails here rather than at the first user who goes looking for it.
 */
describe('README', () => {
  // Vitest's root is the project root; under jsdom `import.meta.url` is an
  // http:// URL and cannot be resolved to a path.
  const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8')

  /** Table rows as `[cell, cell]` pairs, with the alignment padding dropped. */
  const rows = readme
    .split('\n')
    .filter((line) => line.trimStart().startsWith('|'))
    .map((line) =>
      line
        .trim()
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim()),
    )

  it('carries a row for every shortcut', () => {
    for (const shortcut of [...EDITOR_SHORTCUTS, ...LIST_SHORTCUTS, ...MANAGER_SHORTCUTS]) {
      const keys = shortcut.keys.map((key) => `\`${keyText(key)}\``).join(' / ')
      for (const description of [
        shortcut.description,
        shortcut.spriteDescription,
        shortcut.desktopDescription,
      ]) {
        if (!description) continue
        const documented = rows.some((row) => row[0] === keys && row[1] === description)
        expect(documented, `${shortcut.action} (${keys}) is undocumented: ${description}`).toBe(
          true,
        )
      }
    }
  })
})
