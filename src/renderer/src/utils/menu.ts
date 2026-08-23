/**
 * The native menu, from the renderer's side.
 *
 * The menu bar is built in the main process, but what it *offers* is decided
 * here: which actions mean something in the view on screen, and what they are
 * called in the open mode. The first answer comes off the shortcut map's own
 * predicate rather than a restatement of it, so a menu item and its keyboard
 * shortcut cannot disagree about a mode (D10). The second comes off
 * `MENU_ACTIONS`, which words items as menu titles — the help sheet's
 * sentences are not menu titles, so the two are written separately. A title
 * that differs between the shells is picked here too (D14), so the main
 * process never has to ask which shell it is in either.
 *
 * Every function is a no-op in the browser build, where `window.api` is
 * undefined. The views call them unconditionally.
 */

import type { ProjectType } from '@/domain/types'
import { MENU_ACTIONS, type MenuActionItem, type MenuContext } from '@shared/menu'
import { desktop } from './desktop'
import { MANAGER_SHORTCUTS, editorActionsFor, shell } from './shortcuts'

/**
 * Every menu title, worded for the open mode. Main is sent the whole table
 * rather than just the items on screen — it is a couple of dozen short strings,
 * and sending all of them means main never has to decide what a missing one
 * should fall back to.
 */
function labelsFor(type: ProjectType | null): Record<string, string> {
  const desktop = shell() === 'desktop'
  return Object.fromEntries(
    MENU_ACTIONS.map((entry) => [entry.action, menuLabel(entry, type, desktop)]),
  )
}

/**
 * One item's title. The shell wins over the mode, which matches the shortcut
 * map: nothing carries both a `desktopLabel` and a `spriteLabel` today, and if
 * something ever does, "which app is this" is the larger difference.
 */
function menuLabel(entry: MenuActionItem, type: ProjectType | null, desktop: boolean): string {
  if (desktop && entry.desktopLabel) return entry.desktopLabel
  return type === 'sprite' && entry.spriteLabel ? entry.spriteLabel : entry.label
}

/**
 * One action's title, worded for this shell and this mode.
 *
 * Exported because the editor's own Back/Close button wants the same words its
 * File menu item has — "Back to Projects" in the browser, "Close Document" on
 * the desktop (D14) — and taking them from here is what stops the two drifting.
 */
export function actionLabel(action: string, type: ProjectType | null = null): string {
  const entry = MENU_ACTIONS.find((item) => item.action === action)
  return entry ? menuLabel(entry, type, shell() === 'desktop') : action
}

/** What the menu offers while a project of `type` is open. */
export function editorMenuContext(type: ProjectType | null): MenuContext {
  return { enabled: editorActionsFor(type), labels: labelsFor(type) }
}

/** What the menu offers on the project list, where no project is open. */
export function managerMenuContext(): MenuContext {
  return { enabled: MANAGER_SHORTCUTS.map((entry) => entry.action), labels: labelsFor(null) }
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
