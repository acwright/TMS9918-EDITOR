<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import AppButton from '@/components/base/AppButton.vue'
import AnimationPanel from '@/components/editor/AnimationPanel.vue'
import CharacterPanel from '@/components/editor/CharacterPanel.vue'
import CharsetPicker from '@/components/editor/CharsetPicker.vue'
import MulticolorPanel from '@/components/editor/MulticolorPanel.vue'
import ProjectSettingsDialog from '@/components/editor/ProjectSettingsDialog.vue'
import ScreenPanel from '@/components/editor/ScreenPanel.vue'
import SpritePanel from '@/components/editor/SpritePanel.vue'
import SpritePicker from '@/components/editor/SpritePicker.vue'
import { MODES } from '@/domain/modes'
import { useEditorStore, type TransformName } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'

const props = defineProps<{ projectId: string }>()

const router = useRouter()
const store = useProjectsStore()
const editor = useEditorStore()

watch(
  () => props.projectId,
  (id) => {
    store.open(id)
    editor.reset()
  },
  { immediate: true },
)
onBeforeUnmount(() => store.close())

const SAVE_STATE_LABEL = { saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved' } as const

const showSettings = ref(false)

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

// Pattern shifts on Alt+Arrows (plain arrows are left for future cursor use;
// Alt also avoids hijacking browser Back on Windows). `applyTransform` routes
// to charOps or spriteOps depending on the open mode.
const ALT_SHIFTS: Record<string, TransformName> = {
  ArrowLeft: 'shiftLeft',
  ArrowRight: 'shiftRight',
  ArrowUp: 'shiftUp',
  ArrowDown: 'shiftDown',
}

/** Global shortcut map (documented in README). */
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

  if (event.metaKey || event.ctrlKey) {
    const key = event.key.toLowerCase()
    if (key === 'z') {
      event.preventDefault()
      if (event.shiftKey) editor.redo()
      else editor.undo()
    } else if (key === 's') {
      event.preventDefault()
      store.saveCurrent()
    }
    return // leave other browser combos alone
  }

  if (event.altKey) {
    const shift = ALT_SHIFTS[event.key]
    if (shift) {
      event.preventDefault()
      editor.applyTransform(shift)
    }
    return
  }

  switch (event.key) {
    case 'Escape':
      router.push('/')
      return
    case '[':
      // Sprite mode steps through sprite slots; every other mode, characters.
      if (isSprite.value) editor.selectSprite(editor.selectedSprite - 1)
      else editor.selectChar(editor.selectedChar - 1)
      return
    case ']':
      if (isSprite.value) editor.selectSprite(editor.selectedSprite + 1)
      else editor.selectChar(editor.selectedChar + 1)
      return
    case ',':
      // Sprite mode paginates animations where the others paginate screens.
      if (isSprite.value) editor.selectAnimation(editor.selectedAnimation - 1)
      else editor.selectScreen(editor.selectedScreen - 1)
      return
    case '.':
      if (isSprite.value) editor.selectAnimation(editor.selectedAnimation + 1)
      else editor.selectScreen(editor.selectedScreen + 1)
      return
    case ' ':
      if (isSprite.value) {
        event.preventDefault() // Space would otherwise scroll the panel
        editor.togglePlaying()
      }
      return
    case '+':
    case '=':
      // Sprite mode zooms the animation preview; every other mode, the screen.
      if (isSprite.value) editor.zoomPreview(1)
      else editor.zoomScreen(1)
      return
    case '-':
      if (isSprite.value) editor.zoomPreview(-1)
      else editor.zoomScreen(-1)
      return
  }

  switch (event.key.toLowerCase()) {
    case 'g':
      if (!isSprite.value) editor.toggleGrid()
      return
    case 'f':
      editor.applyTransform('fill')
      return
    case 'c':
      editor.applyTransform('clear')
      return
    case 'i':
      editor.applyTransform('invert')
      return
    case 'h':
      editor.applyTransform('flipH')
      return
    case 'v':
      editor.applyTransform('flipV')
      return
    case 'r':
      editor.applyTransform(event.shiftKey ? 'rotateLeft' : 'rotateRight')
      return
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="flex h-dvh flex-col">
    <header class="flex h-12 shrink-0 items-center gap-3 border-b border-ink-800 bg-ink-900 px-3">
      <AppButton
        label="Back to Projects"
        shortcut="Esc"
        placement="bottom"
        @click="router.push('/')"
      >
        <ArrowLeft class="size-4" />
      </AppButton>
      <template v-if="store.current">
        <h1 class="truncate text-2xl">{{ store.current.name }}</h1>
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
    </header>

    <!-- Multicolor: slim colour rail + full-width screen; no tabs, no Character panel -->
    <main
      v-if="store.current && isMulticolor"
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
        <SpritePanel class="mx-auto shrink-0 lg:mx-0" />
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
        <CharacterPanel class="mx-auto shrink-0 lg:mx-0" />
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
      <div class="text-center">
        <p class="font-display text-2xl tracking-wider">Project not found</p>
        <p class="text-sm">It may have been deleted or this link is stale.</p>
      </div>
    </main>
  </div>
</template>
