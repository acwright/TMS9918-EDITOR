import { afterEach, describe, expect, it, vi } from 'vitest'
import { MENU_ACTIONS, MENU_COMMANDS, sampleAction, sampleFromAction } from '@shared/menu'
import { SAMPLES } from '@/samples'
import { actionLabel, editorMenuContext, managerMenuContext } from '../menu'
import { EDITOR_SHORTCUTS, MANAGER_SHORTCUTS, describeShortcut } from '../shortcuts'

/**
 * Pretend the preload bridge is there, which is the only thing that makes
 * `isDesktop()` — and so `shell()` — answer 'desktop'. Nothing here calls the
 * bridge; the wording functions only ask whether it exists.
 */
function asDesktop(): void {
  vi.stubGlobal('api', {})
}

/**
 * The native menu's table lives in `src/shared/` because the main process
 * cannot import the renderer's shortcut map, so the two are held together here
 * instead — the same way `shortcuts.spec.ts` holds the README to the key list.
 */

const SECTIONS = ['file', 'edit', 'pattern', 'view', 'help']

/**
 * Words Title Case leaves lowercase — but never as the first or last word of a
 * title. The macOS HIG's list, which is why "Back to Projects" is right and
 * "Back To Projects" is not.
 */
const MINOR_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'from',
  'in',
  'nor',
  'of',
  'on',
  'or',
  'so',
  'the',
  'to',
  'up',
  'yet',
  'with',
])

/** Whether `title` is Title Case: every word capitalised bar the minor ones. */
function isTitleCase(title: string): boolean {
  const words = title.split(' ')
  return words.every((word, index) => {
    // Hyphens and slashes join words that each get their own capital.
    const parts = word.split(/[-/]/).filter(Boolean)
    return parts.every((part, partIndex) => {
      const first = index === 0 && partIndex === 0
      const last = index === words.length - 1 && partIndex === parts.length - 1
      if (!first && !last && MINOR_WORDS.has(part.toLowerCase())) return part === part.toLowerCase()
      return /^[^a-z]/.test(part)
    })
  })
}

/** Every action the editor and the manager dispatch, ignoring the duplicate `help`. */
const ACTIONS = [
  ...new Set([...EDITOR_SHORTCUTS, ...MANAGER_SHORTCUTS].map((entry) => entry.action)),
]

/** The menu items backed by a key, which is all of them bar the commands. */
const SHORTCUT_ITEMS = MENU_ACTIONS.filter((entry) => !entry.command)

describe('isTitleCase', () => {
  // The checker below is the only thing standing between a menu title and the
  // help sheet's voice, so it is worth knowing it rejects what it should.
  it('rejects the sentence-case titles it replaced', () => {
    expect(isTitleCase('Save now')).toBe(false)
    expect(isTitleCase('Keyboard shortcuts')).toBe(false)
    expect(isTitleCase('Zoom in')).toBe(false)
    expect(isTitleCase('Back To Projects')).toBe(false)
  })

  it('accepts the forms a native menu uses', () => {
    expect(isTitleCase('Back to Projects')).toBe(true)
    expect(isTitleCase('Zoom In')).toBe(true)
    expect(isTitleCase('Play/Pause')).toBe(true)
    expect(isTitleCase('Aspect-Corrected Preview')).toBe(true)
    expect(isTitleCase('New Project…')).toBe(true)
  })
})

describe('the menu table', () => {
  it('carries every editor and manager action exactly once', () => {
    expect(SHORTCUT_ITEMS.map((entry) => entry.action).sort()).toEqual([...ACTIONS].sort())
  })

  it('invents no action of its own', () => {
    for (const entry of SHORTCUT_ITEMS) expect(ACTIONS).toContain(entry.action)
  })

  // The menu's own commands (F7) are the one exception, and they are declared
  // rather than assumed: an item marked `command` has to name one, and a
  // command nobody put in the menu would be unreachable.
  it('marks a command only where it declares one', () => {
    const commands = MENU_ACTIONS.filter((entry) => entry.command).map((entry) => entry.action)
    expect(commands.sort()).toEqual([...MENU_COMMANDS].sort())
    for (const command of MENU_COMMANDS) expect(ACTIONS).not.toContain(command)
  })

  // The help sheet's descriptions are sentences ("Save now", "Fill the
  // character"); a menu title is not. Menu labels are written separately for
  // that reason, so this is what keeps them honest.
  it('titles every item the way a native menu does', () => {
    // Collected rather than asserted one by one, so a failure names every
    // label that needs rewording instead of only the first.
    const wrong = MENU_ACTIONS.flatMap((entry) => [entry.label, entry.spriteLabel ?? []])
      .flat()
      .filter((label) => !isTitleCase(label))
    expect(wrong).toEqual([])
  })

  it('re-words only the items the shortcut map says change on the desktop', () => {
    // The same rule the sprite labels follow: the map decides which actions
    // mean something different, and the menu only supplies the title (D14).
    const varies = new Set<string>(
      EDITOR_SHORTCUTS.filter((entry) => entry.desktopDescription).map((entry) => entry.action),
    )
    const reworded = MENU_ACTIONS.filter((entry) => entry.desktopLabel).map((entry) => entry.action)
    expect(reworded).not.toEqual([])
    expect(reworded.filter((action) => !varies.has(action))).toEqual([])
  })

  it('re-words only the items the shortcut map says change in a sprite project', () => {
    const varies = new Set<string>(
      EDITOR_SHORTCUTS.filter((entry) => entry.spriteDescription).map((entry) => entry.action),
    )
    const reworded = MENU_ACTIONS.filter((entry) => entry.spriteLabel).map((entry) => entry.action)
    expect(reworded.filter((action) => !varies.has(action))).toEqual([])
  })

  it('puts every item in a known section', () => {
    for (const entry of MENU_ACTIONS) expect(SECTIONS).toContain(entry.section)
  })

  it('never opens a section with a separator', () => {
    for (const section of SECTIONS) {
      const first = MENU_ACTIONS.find((entry) => entry.section === section)
      expect(first?.separatorBefore).toBeUndefined()
    }
  })
})

describe('what the menu offers', () => {
  it('greys out everything but the manager’s own items on the project list', () => {
    expect(managerMenuContext().enabled).toEqual(['newProject', 'help'])
  })

  it('offers New Project… and Save a Copy… while a document is open', () => {
    // File ▸ New Project… has to work from the editor, not only from the start
    // screen, and Save a Copy… needs a project to copy (F7).
    const enabled = editorMenuContext('graphics1').enabled
    expect(enabled).toContain('newProject')
    expect(enabled).toContain('saveCopy')
    // Nothing to copy on the start screen; New… is its own.
    expect(managerMenuContext().enabled).not.toContain('saveCopy')
  })

  it('reports the samples New from Sample ▸ is built from', () => {
    for (const context of [editorMenuContext('sprite'), managerMenuContext()]) {
      expect(context.samples.map((sample) => sample.id)).toEqual(SAMPLES.map((s) => s.id))
      expect(context.samples.map((sample) => sample.name)).toEqual(SAMPLES.map((s) => s.name))
    }
  })

  it('offers the editor’s actions for the mode the project is in', () => {
    const graphics = editorMenuContext('graphics1').enabled
    expect(graphics).toContain('toggleGrid')
    // Sprite projects have no screen to lay a grid over, and every other mode
    // has no animation to play.
    expect(graphics).not.toContain('playPause')

    const sprite = editorMenuContext('sprite').enabled
    expect(sprite).toContain('playPause')
    expect(sprite).not.toContain('toggleGrid')

    // Multicolor paints straight onto the screen, so there is no pattern to edit.
    expect(editorMenuContext('multicolor').enabled).not.toContain('fill')
  })

  it('words the paging items for a sprite project', () => {
    expect(editorMenuContext('graphics1').labels['prevChar']).toBe('Previous Character')
    expect(editorMenuContext('sprite').labels['prevChar']).toBe('Previous Sprite')
    expect(editorMenuContext('graphics1').labels['nextScreen']).toBe('Next Screen')
    expect(editorMenuContext('sprite').labels['nextScreen']).toBe('Next Animation')
  })

  it('leaves the mode-neutral items alone in a sprite project', () => {
    // Short titles carry every mode, which is most of why they are short.
    expect(editorMenuContext('sprite').labels['fill']).toBe('Fill')
    expect(editorMenuContext('sprite').labels['rotateLeft']).toBe('Rotate Left')
  })

  it('sends a title for every item, whatever the mode', () => {
    for (const type of ['graphics1', 'multicolor', 'sprite', null] as const) {
      const labels = editorMenuContext(type).labels
      for (const entry of MENU_ACTIONS) expect(labels[entry.action]).toBeTruthy()
    }
  })
})

/**
 * The wording fork (D14). It is the only thing the two shells say differently,
 * and it is decided in the map and the menu table rather than in a view — so
 * this is where both halves are held together.
 */
describe('the desktop shell', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('closes the document where the browser goes back to a list', () => {
    expect(actionLabel('back')).toBe('Back to Projects')
    asDesktop()
    expect(actionLabel('back')).toBe('Close Document')
  })

  it('sends main the shell wording, so main never asks which shell it is', () => {
    asDesktop()
    expect(editorMenuContext('graphics1').labels['back']).toBe('Close Document')
    expect(managerMenuContext().labels['back']).toBe('Close Document')
  })

  it('words the help sheet to match its menu item', () => {
    const back = EDITOR_SHORTCUTS.find((entry) => entry.action === 'back')!
    expect(describeShortcut(back, null)).toBe('Back to the project list')
    asDesktop()
    expect(describeShortcut(back, null)).toBe('Close the document')
  })

  it('leaves every other item alone', () => {
    const browser = editorMenuContext('sprite').labels
    asDesktop()
    const desktop = editorMenuContext('sprite').labels
    const differ = Object.keys(desktop).filter((action) => desktop[action] !== browser[action])
    expect(differ).toEqual(['back'])
  })

  it('offers the same actions in both shells — only the wording forks', () => {
    const browser = editorMenuContext('graphics1').enabled
    asDesktop()
    expect(editorMenuContext('graphics1').enabled).toEqual(browser)
  })
})

/**
 * *New from Sample ▸* carries a sample id rather than an action id (F7), so the
 * two ends of that encoding are held together here.
 */
describe('sample menu actions', () => {
  it('round-trips a sample id', () => {
    for (const sample of SAMPLES) {
      expect(sampleFromAction(sampleAction(sample.id))).toBe(sample.id)
    }
  })

  it('leaves every other action alone', () => {
    for (const entry of MENU_ACTIONS) expect(sampleFromAction(entry.action)).toBeNull()
  })
})
