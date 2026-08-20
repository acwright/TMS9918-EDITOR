<script setup lang="ts">
import { ref } from 'vue'
import { Download, Settings2 } from 'lucide-vue-next'
import AppButton from '@/components/base/AppButton.vue'
import ExportDialog from './ExportDialog.vue'
import SpriteGrid from './SpriteGrid.vue'
import { useEditorStore } from '@/stores/editor'

const editor = useEditorStore()

const emit = defineEmits<{ openSettings: [] }>()

const showExport = ref(false)
</script>

<template>
  <!-- min-h-0 lets the grid shrink to fit rather than forcing the page to scroll -->
  <section class="flex min-h-0 flex-1 flex-col gap-2 pb-4" aria-label="Sprite picker">
    <div class="flex items-center gap-2">
      <h2 class="text-xl">Sprites</h2>
      <span class="font-mono text-xs text-ink-500">
        {{ editor.spriteSize }}×{{ editor.spriteSize }} · {{ editor.spriteSlots }}
      </span>
      <div class="ml-auto flex items-center gap-1">
        <AppButton label="Sprite Settings" @click="emit('openSettings')">
          <Settings2 class="size-4" />
        </AppButton>
        <AppButton label="Export Sprites" @click="showExport = true">
          <Download class="size-4" />
        </AppButton>
      </div>
    </div>

    <ExportDialog v-model="showExport" scope="sprite" />

    <div class="flex min-h-0 flex-1 items-center justify-center">
      <SpriteGrid />
    </div>
  </section>
</template>
