import { describe, expect, it } from 'vitest'
import { MENU_ACTIONS } from '@shared/menu'
import { editorMenuContext, managerMenuContext } from '../menu'
import { EDITOR_SHORTCUTS, MANAGER_SHORTCUTS, describeShortcut } from '../shortcuts'

/**
 * The native menu's table lives in `src/shared/` because the main process
 * cannot import the renderer's shortcut map, so the two are held together here
 * instead — the same way `shortcuts.spec.ts` holds the README to the key list.
 */

const SECTIONS = ['file', 'edit', 'pattern', 'view', 'help']

/** Every action the editor and the manager dispatch, ignoring the duplicate `help`. */
const ACTIONS = [
  ...new Set([...EDITOR_SHORTCUTS, ...MANAGER_SHORTCUTS].map((entry) => entry.action)),
]

describe('the menu table', () => {
  it('carries every editor and manager action exactly once', () => {
    expect([...MENU_ACTIONS].map((entry) => entry.action).sort()).toEqual([...ACTIONS].sort())
  })

  it('invents no action of its own', () => {
    for (const entry of MENU_ACTIONS) expect(ACTIONS).toContain(entry.action)
  })

  it('labels each item with the shortcut’s own description', () => {
    const descriptions = new Map<string, string>(
      [...EDITOR_SHORTCUTS, ...MANAGER_SHORTCUTS].map((entry) => [entry.action, entry.description]),
    )
    for (const entry of MENU_ACTIONS) {
      expect(entry.label).toBe(descriptions.get(entry.action))
    }
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

  it('words the pattern items for a sprite project', () => {
    expect(editorMenuContext('graphics1').labels['fill']).toBe('Fill the character')
    expect(editorMenuContext('sprite').labels['fill']).toBe('Fill the sprite')
  })

  it('takes its wording from describeShortcut, not a copy of it', () => {
    const labels = editorMenuContext('sprite').labels
    for (const entry of EDITOR_SHORTCUTS) {
      expect(labels[entry.action]).toBe(describeShortcut(entry, 'sprite'))
    }
  })
})
