<script setup lang="ts">
import { computed, onMounted, useTemplateRef, watch } from 'vue'
import SpriteListRow from './SpriteListRow.vue'
import { sheetColumns } from '@/utils/spriteRender'
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'

/**
 * The sprite set as a list: one slot a row, with the things the sheet cannot
 * say — the number in both bases, the patterns it occupies, its colour, and
 * whether it is blank or invisible.
 *
 * A listbox rather than 256 tab stops, on the same contract the character set's
 * list uses: one roving `tabindex`, arrows move the selection, and the selected
 * row is scrolled into view however the selection changed — including from `[`
 * and `]` outside this component (PLAN.md §16, Decision 39).
 */
const projects = useProjectsStore()
const editor = useEditorStore()

const slots = computed(() =>
  projects.current ? Array.from({ length: editor.spriteSlots }, (_, slot) => slot) : [],
)

/** A page is one row of the sheet: 16 slots at 8×8, 8 at 16×16. */
const page = computed(() => sheetColumns(editor.spriteSize))

const list = useTemplateRef('list')

function move(delta: number): void {
  const last = slots.value.length - 1
  editor.selectSprite(Math.max(0, Math.min(last, editor.selectedSprite + delta)))
}

function onKeydown(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  switch (event.key) {
    case 'ArrowDown':
      move(1)
      break
    case 'ArrowUp':
      move(-1)
      break
    case 'PageDown':
      move(page.value)
      break
    case 'PageUp':
      move(-page.value)
      break
    case 'Home':
      editor.selectSprite(0)
      break
    case 'End':
      editor.selectSprite(slots.value.length - 1)
      break
    default:
      return
  }
  event.preventDefault()
  event.stopPropagation()
}

/**
 * Keep the selection visible. `nearest` so a selection already on screen —
 * which is most clicks — doesn't jerk the list around it.
 */
function reveal(slot: number): void {
  const row = list.value?.querySelector(`[data-slot="${slot}"]`)
  row?.scrollIntoView({ block: 'nearest' })
  // Follow the selection with focus only while the list already has it,
  // so clicking a sprite elsewhere doesn't steal it.
  if (list.value?.contains(document.activeElement)) (row as HTMLElement | null)?.focus()
}

watch(() => editor.selectedSprite, reveal)

/**
 * …including the selection this list opens on. Switching layout is not a
 * selection change, so without this, coming to the list to read the details of
 * the slot you just picked in the sheet lands you at the top of the set.
 */
onMounted(() => reveal(editor.selectedSprite))
</script>

<template>
  <div
    ref="list"
    class="min-h-0 flex-1 overflow-y-auto rounded-sm border border-ink-800"
    role="listbox"
    aria-label="Sprites"
    @keydown="onKeydown"
  >
    <SpriteListRow v-for="slot in slots" :key="slot" :slot-index="slot" />
  </div>
</template>
