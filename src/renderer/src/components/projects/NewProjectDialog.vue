<script setup lang="ts">
/**
 * New Project, in both shells.
 *
 * Two optional inputs make it the desktop's *New…* as well as the browser's,
 * without a branch on the shell (PLAN.md D13):
 *
 * - **`location`**, when bound, adds the row that says where the file goes
 *   (D10). The browser's manager binds nothing and shows nothing; the string
 *   is display only — the parent asks main for it and main owns the path (D8).
 * - **`sample`**, when set, makes this *New from Sample…*: the mode is the
 *   sample's, so the mode choices go away and only the name and the location
 *   are left to answer.
 */
import { computed, ref, watch } from 'vue'
import { FolderOpen, Plus } from 'lucide-vue-next'
import AppButton from '@/components/base/AppButton.vue'
import AppDialog from '@/components/base/AppDialog.vue'
import AppTextInput from '@/components/base/AppTextInput.vue'
import { MODES } from '@/domain/modes'
import type { CreateProjectOptions } from '@/domain/factory'
import type { Sample } from '@/samples'
import type { G2CharsetMode, ProjectType, SpriteSize } from '@/domain/types'

const open = defineModel<boolean>({ required: true })
/** Where the file goes, as text. Undefined in the browser, which has no folder. */
const location = defineModel<string>('location')

const props = defineProps<{ sample?: Sample | null }>()

const emit = defineEmits<{
  create: [options: CreateProjectOptions]
  /** The location row's button; the parent runs the folder dialog (D8). */
  chooseLocation: []
}>()

const MODE_CHOICES: { type: ProjectType; hint: string }[] = [
  { type: 'text', hint: '40 × 24 · one global color pair' },
  { type: 'graphics1', hint: '32 × 24 · colors per 8-character group' },
  { type: 'graphics2', hint: '32 × 24 · colors per pixel row' },
  { type: 'multicolor', hint: '64 × 48 · one solid color per 4×4 block' },
  { type: 'sprite', hint: 'sprite patterns + animations · no screen' },
]

const G2_CHOICES: { mode: G2CharsetMode; label: string; hint: string }[] = [
  { mode: 'mirrored', label: 'Mirrored', hint: 'one charset shared by all screen thirds' },
  { mode: 'independent', label: 'Independent', hint: 'a separate charset per screen third' },
]

const SPRITE_SIZE_CHOICES: { size: SpriteSize; label: string; hint: string }[] = [
  { size: 8, label: '8 × 8', hint: '256 sprites, one pattern each' },
  { size: 16, label: '16 × 16', hint: '64 sprites, four patterns each' },
]

const name = ref('')
const type = ref<ProjectType>('graphics1')
const g2CharsetMode = ref<G2CharsetMode>('mirrored')
const spriteSize = ref<SpriteSize>(16)

// Reset the form each time the dialog opens. A sample brings its own name and
// mode, so the form opens as "this one, called this, here" rather than blank.
watch(open, (isOpen) => {
  if (isOpen) {
    name.value = props.sample?.name ?? ''
    type.value = 'graphics1'
    g2CharsetMode.value = 'mirrored'
    spriteSize.value = 16
  }
})

const canCreate = computed(() => name.value.trim().length > 0)

/** The mode questions belong to a blank project; a sample has already answered them. */
const asksForMode = computed(() => !props.sample)

function submit() {
  if (!canCreate.value) return
  emit('create', {
    name: name.value.trim(),
    type: type.value,
    g2CharsetMode: type.value === 'graphics2' ? g2CharsetMode.value : undefined,
    spriteSize: type.value === 'sprite' ? spriteSize.value : undefined,
  })
}
</script>

<template>
  <AppDialog v-model="open" :title="sample ? 'New from Sample' : 'New Project'">
    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <AppTextInput v-model="name" label="Name" placeholder="My Project" autofocus />

      <!-- Present only where a document has a folder to live in (D10). -->
      <div v-if="location !== undefined">
        <span class="font-display mb-1 block text-sm tracking-wider text-ink-400">Location</span>
        <div class="flex items-center gap-2">
          <!-- dir=rtl keeps the *end* of a long path visible, which is the half
               that says which folder this is -->
          <p
            class="min-w-0 flex-1 truncate rounded-sm border border-ink-700 bg-ink-850 px-3 py-2 text-left text-sm text-ink-300"
            dir="rtl"
            :title="location"
          >
            {{ location }}
          </p>
          <AppButton label="Choose Folder" @click="emit('chooseLocation')">
            <FolderOpen class="size-4" />
          </AppButton>
        </div>
      </div>

      <fieldset v-if="asksForMode">
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

      <fieldset v-if="asksForMode && type === 'graphics2'">
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

      <fieldset v-if="asksForMode && type === 'sprite'">
        <legend class="font-display mb-1 block text-sm tracking-wider text-ink-400">
          Sprite Size
        </legend>
        <div class="flex flex-col gap-1.5">
          <label
            v-for="choice in SPRITE_SIZE_CHOICES"
            :key="choice.size"
            class="flex cursor-pointer items-baseline justify-between gap-3 rounded-sm border px-3 py-2 transition-colors"
            :class="
              spriteSize === choice.size
                ? 'border-ink-300 bg-ink-800'
                : 'border-ink-700 bg-ink-850 hover:border-ink-500'
            "
          >
            <input
              v-model="spriteSize"
              type="radio"
              name="spriteSize"
              :value="choice.size"
              class="sr-only"
            />
            <span class="font-display text-base tracking-wider">{{ choice.label }}</span>
            <span class="text-xs text-ink-400">{{ choice.hint }}</span>
          </label>
        </div>
        <p class="mt-1.5 text-xs text-ink-500">
          Changeable later in project settings — nothing is lost either way.
        </p>
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
