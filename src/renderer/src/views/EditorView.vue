<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeft, Keyboard } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import AppButton from '@/components/base/AppButton.vue'
import HelpDialog from '@/components/HelpDialog.vue'
import AnimationPanel from '@/components/editor/AnimationPanel.vue'
import CharacterPanel from '@/components/editor/CharacterPanel.vue'
import CharsetPicker from '@/components/editor/CharsetPicker.vue'
import MulticolorPanel from '@/components/editor/MulticolorPanel.vue'
import ProjectSettingsDialog from '@/components/editor/ProjectSettingsDialog.vue'
import ScreenPanel from '@/components/editor/ScreenPanel.vue'
import SpritePanel from '@/components/editor/SpritePanel.vue'
import SpritePicker from '@/components/editor/SpritePicker.vue'
import { MODES } from '@/domain/modes'
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'
import { actionLabel, editorMenuContext, onMenuAction, reportMenuContext } from '@/utils/menu'
import { matchEditorShortcut, shortcutLabel, type EditorAction } from '@/utils/shortcuts'

const props = defineProps<{ projectId: string }>()

const router = useRouter()
const store = useProjectsStore()
const editor = useEditorStore()

/**
 * Opening is async now that storage is (PLAN.md D1), so the view has three
 * states rather than two: it is loading, it has a project, or the project
 * could not be read. Without the first, the missing-project panel flashes on
 * every navigation while the load is in flight.
 */
type OpenState = 'loading' | 'ready' | 'missing'
const openState = ref<OpenState>('loading')

watch(
  () => props.projectId,
  async (id) => {
    openState.value = 'loading'
    const project = await store.open(id)
    // A newer navigation can land mid-load. The store already drops the stale
    // result; this drops the stale view state that would follow it.
    if (id !== props.projectId) return
    openState.value = project ? 'ready' : 'missing'
    editor.reset()
  },
  { immediate: true },
)
onBeforeUnmount(() => void store.close())

const SAVE_STATE_LABEL = { saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved' } as const

/**
 * What the header shows the open project as.
 *
 * On the desktop that is the *file's* name — a document is called what its file
 * is called, and the header is the only place that says so now that no list
 * view carries it. In the browser `documentName` is null and the project's own
 * name stands, exactly as before. A fallback, not a branch on the shell.
 */
const title = computed(() => store.documentName ?? store.current?.name ?? '')

/**
 * "Back to Projects" in the browser, "Close Document" on the desktop (D14).
 * Taken from the menu table rather than written here, so this button and its
 * File menu item cannot end up saying different things.
 */
const backLabel = computed(() => actionLabel('back', store.current?.type ?? null))

const showSettings = ref(false)
const showHelp = ref(false)

// Multicolor has no character/charset editing — a single colour rail + screen,
// so it skips the Character panel and the responsive tab split entirely (§10 Decision 10).
const isMulticolor = computed(() => store.current?.type === 'multicolor')

// Sprite mode has no screen at all: sprite editor + picker on the left, the
// animation preview on the right (§14 Decision 28).
const isSprite = computed(() => store.current?.type === 'sprite')

// Below lg the two columns become tabs (side by side at lg+ regardless)
const activeTab = ref<'character' | 'screen'>('character')

/** Tab labels differ in sprite mode, where the columns aren't character/screen. */
const tabLabels = computed(() =>
  isSprite.value
    ? { character: 'Sprite', screen: 'Preview' }
    : { character: 'Character', screen: 'Screen' },
)

/**
 * What each shortcut does. Keyed by action rather than by key, and exhaustive
 * over `EditorAction`, so a shortcut added to the map without a handler here
 * fails the type-check instead of doing nothing (`utils/shortcuts.ts`).
 *
 * Several keys mean one thing in a sprite project and another everywhere else:
 * `applyTransform` already routes to charOps or spriteOps for the open mode,
 * and the paging keys branch here. The map hides the ones a mode has no answer
 * for, so those never reach this table at all.
 */
const ACTIONS: Record<EditorAction, () => void> = {
  undo: () => editor.undo(),
  redo: () => editor.redo(),
  save: () => store.saveCurrent(),
  help: () => (showHelp.value = true),
  back: () => router.push('/'),

  // Sprite mode steps through sprite slots; every other mode, characters.
  prevChar: () =>
    isSprite.value
      ? editor.selectSprite(editor.selectedSprite - 1)
      : editor.selectChar(editor.selectedChar - 1),
  nextChar: () =>
    isSprite.value
      ? editor.selectSprite(editor.selectedSprite + 1)
      : editor.selectChar(editor.selectedChar + 1),
  fill: () => editor.applyTransform('fill'),
  clear: () => editor.applyTransform('clear'),
  invert: () => editor.applyTransform('invert'),
  flipH: () => editor.applyTransform('flipH'),
  flipV: () => editor.applyTransform('flipV'),
  rotateRight: () => editor.applyTransform('rotateRight'),
  rotateLeft: () => editor.applyTransform('rotateLeft'),
  // Alt rather than bare arrows: it leaves plain arrows for future cursor use
  // and avoids hijacking browser Back on Windows.
  shiftLeft: () => editor.applyTransform('shiftLeft'),
  shiftRight: () => editor.applyTransform('shiftRight'),
  shiftUp: () => editor.applyTransform('shiftUp'),
  shiftDown: () => editor.applyTransform('shiftDown'),

  // Sprite mode paginates animations where the others paginate screens, and
  // zooms the animation preview where they zoom the screen.
  prevScreen: () =>
    isSprite.value
      ? editor.selectAnimation(editor.selectedAnimation - 1)
      : editor.selectScreen(editor.selectedScreen - 1),
  nextScreen: () =>
    isSprite.value
      ? editor.selectAnimation(editor.selectedAnimation + 1)
      : editor.selectScreen(editor.selectedScreen + 1),
  zoomIn: () => (isSprite.value ? editor.zoomPreview(1) : editor.zoomScreen(1)),
  zoomOut: () => (isSprite.value ? editor.zoomPreview(-1) : editor.zoomScreen(-1)),
  toggleGrid: () => editor.toggleGrid(),
  playPause: () => editor.togglePlaying(),
}

/** Controls that answer to Space or Enter themselves — never steal those keys. */
const ACTIVATABLE = 'button, a, [role="button"], [role="option"], [role="tab"]'

function onKeydown(event: KeyboardEvent) {
  // Never fire while typing or while a dialog is open (Esc there closes it natively)
  const target = event.target as HTMLElement | null
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable ||
    document.querySelector('dialog[open]')
  ) {
    return
  }

  // Space play/pause would otherwise swallow the press that activates a
  // focused button — the animation controls among them.
  if ((event.key === ' ' || event.key === 'Enter') && target?.closest(ACTIVATABLE)) return

  const action = matchEditorShortcut(event, store.current?.type ?? null)
  if (!action) return
  event.preventDefault()
  ACTIONS[action]()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

// Desktop only, and inert in a browser tab. A menu item carries the same
// action id a key would, so it lands in the table above — no second command
// list, and nothing to keep in step.
let stopMenuAction: (() => void) | undefined
onMounted(() => {
  stopMenuAction = onMenuAction((action) => {
    if (action in ACTIONS) ACTIONS[action as EditorAction]()
  })
})
onBeforeUnmount(() => stopMenuAction?.())

// The open mode decides which items are live and how they are worded, so the
// menu is told again whenever it changes — including the change from "no
// project yet" to the one that finished loading.
watch(
  () => store.current?.type ?? null,
  (type) => reportMenuContext(editorMenuContext(type)),
  { immediate: true },
)
</script>

<template>
  <div class="flex h-dvh flex-col">
    <header class="flex h-12 shrink-0 items-center gap-3 border-b border-ink-800 bg-ink-900 px-3">
      <AppButton
        :label="backLabel"
        :shortcut="shortcutLabel('back')"
        placement="bottom"
        @click="router.push('/')"
      >
        <ArrowLeft class="size-4" />
      </AppButton>
      <template v-if="store.current">
        <h1 class="truncate text-2xl">{{ title }}</h1>
        <span
          class="shrink-0 rounded-xs border border-ink-600 px-1.5 py-0.5 text-[10px] tracking-wider text-ink-300 uppercase"
        >
          {{ MODES[store.current.type].label }}
        </span>
        <!-- Fixed width so the changing label doesn't shift neighboring content -->
        <span class="ml-auto w-14 shrink-0 text-right text-xs text-ink-500">
          {{ SAVE_STATE_LABEL[store.saveState] }}
        </span>
      </template>
      <!-- Reachable by pointer as well as by key: on a tablet the shortcut that
           opens this dialog is the one thing the user cannot press -->
      <AppButton
        label="Keyboard Shortcuts"
        :shortcut="shortcutLabel('help')"
        placement="bottom"
        :class="store.current ? '' : 'ml-auto'"
        @click="showHelp = true"
      >
        <Keyboard class="size-4" />
      </AppButton>
    </header>

    <main
      v-if="openState === 'loading'"
      class="flex flex-1 items-center justify-center text-ink-500"
    >
      <p class="font-display text-2xl tracking-wider">Opening…</p>
    </main>

    <!-- Multicolor: slim colour rail + full-width screen; no tabs, no Character panel -->
    <main
      v-else-if="store.current && isMulticolor"
      class="flex min-h-0 flex-1 flex-col lg:flex-row"
    >
      <aside
        class="shrink-0 overflow-x-hidden overflow-y-auto border-b border-ink-800 p-4 lg:w-64 lg:border-r lg:border-b-0"
      >
        <MulticolorPanel />
      </aside>
      <div class="flex min-h-0 min-w-0 flex-1 p-4">
        <ScreenPanel />
      </div>
    </main>

    <!-- Sprite: sprite editor + picker on the left, animation preview on the right.
         Same two-column/tabbed shape as the character modes, no screen anywhere. -->
    <main v-else-if="store.current && isSprite" class="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div class="flex shrink-0 gap-1 border-b border-ink-800 p-2 lg:hidden">
        <button
          v-for="tab in ['character', 'screen'] as const"
          :key="tab"
          type="button"
          class="font-display flex-1 rounded-sm border py-2 text-sm tracking-wider transition-colors"
          :class="
            activeTab === tab
              ? 'border-ink-300 bg-ink-100 text-ink-950'
              : 'border-ink-700 bg-ink-850 text-ink-300'
          "
          @click="activeTab = tab"
        >
          {{ tabLabels[tab] }}
        </button>
      </div>

      <aside
        class="min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto p-4 lg:flex lg:flex-none lg:shrink-0 lg:border-r lg:border-ink-800"
        :class="activeTab === 'character' ? 'flex' : 'hidden'"
      >
        <SpritePanel class="shrink-0" />
        <hr class="shrink-0 border-ink-800" />
        <SpritePicker @open-settings="showSettings = true" />
      </aside>

      <div
        class="min-h-0 min-w-0 flex-1 overflow-auto p-4 lg:flex"
        :class="activeTab === 'screen' ? 'flex' : 'hidden'"
      >
        <AnimationPanel />
      </div>

      <ProjectSettingsDialog v-model="showSettings" />
    </main>

    <main v-else-if="store.current" class="flex min-h-0 flex-1 flex-col lg:flex-row">
      <!-- Mobile/portrait tab switcher (hidden once both columns fit side by side) -->
      <div class="flex shrink-0 gap-1 border-b border-ink-800 p-2 lg:hidden">
        <button
          v-for="tab in ['character', 'screen'] as const"
          :key="tab"
          type="button"
          class="font-display flex-1 rounded-sm border py-2 text-sm tracking-wider transition-colors"
          :class="
            activeTab === tab
              ? 'border-ink-300 bg-ink-100 text-ink-950'
              : 'border-ink-700 bg-ink-850 text-ink-300'
          "
          @click="activeTab = tab"
        >
          {{ tabLabels[tab] }}
        </button>
      </div>

      <!-- The left column scrolls vertically as a last resort; x is clipped because
           the invisible hover tooltips overhang the edge and would otherwise create
           a horizontal scrollbar -->
      <!-- flex-1 fills the column height on mobile so the picker can expand;
           on lg the aside hugs its width instead (flex-none + shrink-0) -->
      <aside
        class="min-h-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto p-4 lg:flex lg:flex-none lg:shrink-0 lg:border-r lg:border-ink-800 lg:p-4"
        :class="activeTab === 'character' ? 'flex' : 'hidden'"
      >
        <CharacterPanel class="shrink-0" />
        <hr class="shrink-0 border-ink-800" />
        <CharsetPicker @open-settings="showSettings = true" />
      </aside>

      <!-- Wrapper toggles visibility so it doesn't fight ScreenPanel's own `flex`.
           min-w-0 lets it shrink below the zoomed canvas width so the panel's own
           overflow scrolls instead of pushing the whole page sideways. -->
      <div
        class="min-h-0 min-w-0 flex-1 p-4 lg:flex"
        :class="activeTab === 'screen' ? 'flex' : 'hidden'"
      >
        <ScreenPanel />
      </div>

      <ProjectSettingsDialog v-model="showSettings" />
    </main>

    <main v-else class="flex flex-1 items-center justify-center text-ink-500">
      <div class="flex flex-col items-center gap-4 text-center">
        <div>
          <p class="font-display text-2xl tracking-wider">This project could not be opened</p>
          <!-- The banner above carries the reason when there is one to give —
               a file that moved, or one that is not a project (Phase F3). -->
          <p class="text-sm">
            {{ store.lastError ?? 'It may have been deleted, or this link is stale.' }}
          </p>
        </div>
        <button
          type="button"
          class="font-display rounded-sm border border-ink-600 px-3 py-2 text-sm tracking-wider text-ink-200 transition-colors hover:bg-ink-800"
          @click="router.push('/')"
        >
          {{ backLabel }}
        </button>
      </div>
    </main>

    <HelpDialog v-model="showHelp" :type="store.current?.type ?? null" />
  </div>
</template>
