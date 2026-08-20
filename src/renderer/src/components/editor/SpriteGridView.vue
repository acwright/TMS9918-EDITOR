<script setup lang="ts">
import { computed, onMounted, useTemplateRef, watch } from 'vue'
import SpriteCell from './SpriteCell.vue'
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'

/**
 * The set as fixed-size slots that wrap, scrolling when they run past the
 * column — not the sheet with a scrollbar.
 *
 * The sheet is square by construction: 16 × 16 slots of 8 px or 8 × 8 of 16 px,
 * 128 × 128 logical pixels either way. Fitting the width and letting it run
 * tall, which is what the character set's grid does with its 8 × 32 set, would
 * therefore redraw the same square picture the sheet already gives. What this
 * view is for is the *fixed* cell: 48 px a slot, as many a row as fit
 * (PLAN.md §16, Decision 36).
 */
const projects = useProjectsStore()
const editor = useEditorStore()

const slots = computed(() =>
  projects.current ? Array.from({ length: editor.spriteSlots }, (_, slot) => slot) : [],
)

const scroller = useTemplateRef('scroller')

/**
 * Keep the selection visible however it changed — including `[` / `]` from
 * `EditorView`, which never touch this component. `nearest` so a slot already
 * on screen, which is most clicks, doesn't jerk the grid around it.
 */
function reveal(slot: number): void {
  scroller.value?.querySelector(`[data-slot="${slot}"]`)?.scrollIntoView({ block: 'nearest' })
}

watch(() => editor.selectedSprite, reveal)

/** …including the selection this view opens on, which is not a change. */
onMounted(() => reveal(editor.selectedSprite))
</script>

<template>
  <div ref="scroller" class="min-h-0 flex-1 overflow-y-auto">
    <div
      class="grid gap-1 p-1"
      style="grid-template-columns: repeat(auto-fill, minmax(48px, 1fr))"
      role="group"
      :aria-label="`Sprites 0–${editor.spriteSlots - 1}`"
    >
      <SpriteCell v-for="slot in slots" :key="slot" :slot-index="slot" />
    </div>
  </div>
</template>
