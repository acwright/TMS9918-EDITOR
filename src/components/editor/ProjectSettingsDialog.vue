<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, TriangleAlert } from 'lucide-vue-next'
import AppButton from '@/components/base/AppButton.vue'
import AppDialog from '@/components/base/AppDialog.vue'
import type { G2CharsetMode } from '@/domain/types'
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'

const open = defineModel<boolean>({ required: true })

const projects = useProjectsStore()
const editor = useEditorStore()

const CHOICES: { mode: G2CharsetMode; label: string; hint: string }[] = [
  { mode: 'mirrored', label: 'Mirrored', hint: 'one charset shared by all screen thirds' },
  { mode: 'independent', label: 'Independent', hint: 'a separate charset per screen third' },
]

const currentMode = computed<G2CharsetMode>(
  () => projects.current?.settings.g2CharsetMode ?? 'mirrored',
)

const selected = ref<G2CharsetMode>('mirrored')

watch(open, (isOpen) => {
  if (isOpen) selected.value = currentMode.value
})

const isChanged = computed(() => selected.value !== currentMode.value)
const isDestructive = computed(
  () => isChanged.value && currentMode.value === 'independent' && selected.value === 'mirrored',
)

function apply() {
  if (!isChanged.value) return
  editor.setG2CharsetMode(selected.value)
  open.value = false
}
</script>

<template>
  <AppDialog v-model="open" title="Project Settings">
    <fieldset>
      <legend class="font-display mb-1 block text-sm tracking-wider text-ink-400">
        Charset Arrangement
      </legend>
      <div class="flex flex-col gap-1.5">
        <label
          v-for="choice in CHOICES"
          :key="choice.mode"
          class="flex cursor-pointer items-baseline justify-between gap-3 rounded-sm border px-3 py-2 transition-colors"
          :class="
            selected === choice.mode
              ? 'border-ink-300 bg-ink-800'
              : 'border-ink-700 bg-ink-850 hover:border-ink-500'
          "
        >
          <input
            v-model="selected"
            type="radio"
            name="g2CharsetModeSetting"
            :value="choice.mode"
            class="sr-only"
          />
          <span class="font-display text-base tracking-wider">{{ choice.label }}</span>
          <span class="text-xs text-ink-400">{{ choice.hint }}</span>
        </label>
      </div>

      <p v-if="isChanged && !isDestructive" class="mt-2 text-xs text-ink-400">
        The current charset will be copied to all three sets.
      </p>
      <div
        v-if="isDestructive"
        class="mt-2 flex items-start gap-2 rounded-sm border border-vdp-dark-red bg-vdp-dark-red/15 px-3 py-2 text-xs text-ink-100"
        role="alert"
      >
        <TriangleAlert class="mt-0.5 size-4 shrink-0 text-vdp-medium-red" />
        <p>
          Converting to mirrored keeps <strong>Set 1</strong> and discards
          <strong>Sets 2 and 3</strong>, including their colors. You can undo this while the project
          is open.
        </p>
      </div>
    </fieldset>

    <template #footer>
      <AppButton label="Cancel" show-label @click="open = false" />
      <AppButton
        :label="isDestructive ? 'Convert & Discard' : 'Convert'"
        show-label
        :disabled="!isChanged"
        @click="apply"
      >
        <Check class="size-4" />
      </AppButton>
    </template>
  </AppDialog>
</template>
