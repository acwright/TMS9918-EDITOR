/**
 * The native menu, from the renderer's side.
 *
 * The menu bar is built in the main process, but what it *offers* is decided
 * here: which actions mean something in the view on screen, and what they are
 * called in the open mode. Both answers already exist in the shortcut map, so
 * this file reads them off it rather than restating them — a menu item and its
 * keyboard shortcut cannot disagree about a mode they were told about by the
 * same predicate (D10).
 *
 * Every function is a no-op in the browser build, where `window.api` is
 * undefined. The views call them unconditionally.
 */

import type { ProjectType } from '@/domain/types'
import type { MenuContext } from '@shared/menu'
import { desktop } from './desktop'
import {
  EDITOR_SHORTCUTS,
  MANAGER_SHORTCUTS,
  describeShortcut,
  editorActionsFor,
  type Shortcut,
} from './shortcuts'

/** Labels for a set of shortcuts, worded for the open mode. */
function labelsFor(
  shortcuts: readonly Shortcut[],
  type: ProjectType | null,
): Record<string, string> {
  return Object.fromEntries(
    shortcuts.map((entry) => [entry.action, describeShortcut(entry, type)]),
  )
}

/** What the menu offers while a project of `type` is open. */
export function editorMenuContext(type: ProjectType | null): MenuContext {
  return { enabled: editorActionsFor(type), labels: labelsFor(EDITOR_SHORTCUTS, type) }
}

/** What the menu offers on the project list, where no project is open. */
export function managerMenuContext(): MenuContext {
  return {
    enabled: MANAGER_SHORTCUTS.map((entry) => entry.action),
    labels: labelsFor(MANAGER_SHORTCUTS, null),
  }
}

/** Tell the native menu what this view offers. */
export function reportMenuContext(context: MenuContext): void {
  desktop()?.menu.setContext(context)
}

/**
 * Run `callback` when a menu item is chosen. Returns an unsubscribe function,
 * which is a no-op in the browser.
 */
export function onMenuAction(callback: (action: string) => void): () => void {
  return desktop()?.menu.onAction(callback) ?? (() => {})
}
