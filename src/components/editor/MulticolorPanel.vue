<script setup lang="ts">
import { computed } from 'vue'
import AppTooltip from '@/components/base/AppTooltip.vue'
import ColorPicker from './ColorPicker.vue'
import { PALETTE } from '@/domain/palette'
import { useEditorStore } from '@/stores/editor'

const editor = useEditorStore()

const paintName = computed(() => PALETTE[editor.paintColor]?.name ?? '—')
const backdropName = computed(() => PALETTE[editor.backdrop]?.name ?? '—')
</script>

<template>
  <section class="flex flex-col gap-5" aria-label="Multicolor colours">
    <div class="flex flex-col gap-1.5">
      <div class="flex items-baseline justify-between gap-2">
        <h2 class="font-display text-sm tracking-wider text-ink-400">Paint Colour</h2>
        <span class="truncate text-xs text-ink-500">{{ paintName }}</span>
      </div>
      <ColorPicker single-select />
    </div>

    <div class="flex flex-col gap-1.5">
      <div class="flex items-baseline justify-between gap-2">
        <h2 class="font-display text-sm tracking-wider text-ink-400">Backdrop</h2>
        <span class="truncate text-xs text-ink-500">{{ backdropName }}</span>
      </div>
      <div class="grid grid-cols-8 gap-1" @contextmenu.prevent>
        <AppTooltip
          v-for="entry in PALETTE"
          :key="entry.index"
          :label="entry.name"
          :placement="entry.index < 8 ? 'top' : 'bottom'"
        >
          <button
            type="button"
            class="h-6 w-full cursor-pointer rounded-sm border transition-[border-color] hover:border-ink-300 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink-300"
            :class="[
              { 'bg-checker': !entry.hex },
              entry.index === editor.backdrop
                ? 'border-ink-100 outline-2 outline-offset-2 outline-ink-100'
                : 'border-ink-600',
            ]"
            :style="entry.hex ? { backgroundColor: entry.hex } : undefined"
            :aria-label="`Backdrop: ${entry.name}`"
            :aria-pressed="entry.index === editor.backdrop"
            @click="editor.setBackdrop(entry.index)"
          />
        </AppTooltip>
      </div>
    </div>
  </section>
</template>
