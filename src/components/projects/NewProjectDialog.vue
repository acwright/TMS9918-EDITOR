<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus } from 'lucide-vue-next'
import AppButton from '@/components/base/AppButton.vue'
import AppDialog from '@/components/base/AppDialog.vue'
import AppTextInput from '@/components/base/AppTextInput.vue'
import { MODES } from '@/domain/modes'
import type { CreateProjectOptions } from '@/domain/factory'
import type { G2CharsetMode, ProjectType } from '@/domain/types'

const open = defineModel<boolean>({ required: true })

const emit = defineEmits<{ create: [options: CreateProjectOptions] }>()

const MODE_CHOICES: { type: ProjectType; hint: string }[] = [
  { type: 'text', hint: '40 × 24 · one global color pair' },
  { type: 'graphics1', hint: '32 × 24 · colors per 8-character group' },
  { type: 'graphics2', hint: '32 × 24 · colors per pixel row' },
  { type: 'multicolor', hint: '64 × 48 · one solid color per 4×4 block' },
]

const G2_CHOICES: { mode: G2CharsetMode; label: string; hint: string }[] = [
  { mode: 'mirrored', label: 'Mirrored', hint: 'one charset shared by all screen thirds' },
  { mode: 'independent', label: 'Independent', hint: 'a separate charset per screen third' },
]

const name = ref('')
const type = ref<ProjectType>('graphics1')
const g2CharsetMode = ref<G2CharsetMode>('mirrored')

// Reset the form each time the dialog opens
watch(open, (isOpen) => {
  if (isOpen) {
    name.value = ''
    type.value = 'graphics1'
    g2CharsetMode.value = 'mirrored'
  }
})

const canCreate = computed(() => name.value.trim().length > 0)

function submit() {
  if (!canCreate.value) return
  emit('create', {
    name: name.value.trim(),
    type: type.value,
    g2CharsetMode: type.value === 'graphics2' ? g2CharsetMode.value : undefined,
  })
}
</script>

<template>
  <AppDialog v-model="open" title="New Project">
    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <AppTextInput v-model="name" label="Name" placeholder="My Project" autofocus />

      <fieldset>
        <legend class="font-display mb-1 block text-sm tracking-wider text-ink-400">Mode</legend>
        <div class="flex flex-col gap-1.5">
          <label
            v-for="choice in MODE_CHOICES"
            :key="choice.type"
            class="flex cursor-pointer items-baseline justify-between gap-3 rounded-sm border px-3 py-2 transition-colors"
            :class="
              type === choice.type
                ? 'border-ink-300 bg-ink-800'
                : 'border-ink-700 bg-ink-850 hover:border-ink-500'
            "
          >
            <input v-model="type" type="radio" name="mode" :value="choice.type" class="sr-only" />
            <span class="font-display text-base tracking-wider">{{
              MODES[choice.type].label
            }}</span>
            <span class="text-xs text-ink-400">{{ choice.hint }}</span>
          </label>
        </div>
      </fieldset>

      <fieldset v-if="type === 'graphics2'">
        <legend class="font-display mb-1 block text-sm tracking-wider text-ink-400">
          Charset Arrangement
        </legend>
        <div class="flex flex-col gap-1.5">
          <label
            v-for="choice in G2_CHOICES"
            :key="choice.mode"
            class="flex cursor-pointer items-baseline justify-between gap-3 rounded-sm border px-3 py-2 transition-colors"
            :class="
              g2CharsetMode === choice.mode
                ? 'border-ink-300 bg-ink-800'
                : 'border-ink-700 bg-ink-850 hover:border-ink-500'
            "
          >
            <input
              v-model="g2CharsetMode"
              type="radio"
              name="g2CharsetMode"
              :value="choice.mode"
              class="sr-only"
            />
            <span class="font-display text-base tracking-wider">{{ choice.label }}</span>
            <span class="text-xs text-ink-400">{{ choice.hint }}</span>
          </label>
        </div>
        <p class="mt-1.5 text-xs text-ink-500">Convertible later in project settings.</p>
      </fieldset>

      <!-- Hidden submit so Enter in the name field creates the project -->
      <button type="submit" class="hidden" :disabled="!canCreate" />
    </form>

    <template #footer>
      <AppButton label="Create" show-label :disabled="!canCreate" @click="submit">
        <Plus class="size-4" />
      </AppButton>
    </template>
  </AppDialog>
</template>
