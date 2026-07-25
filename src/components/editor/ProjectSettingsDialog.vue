<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, TriangleAlert } from 'lucide-vue-next'
import AppButton from '@/components/base/AppButton.vue'
import AppDialog from '@/components/base/AppDialog.vue'
import type { G2CharsetMode, SpriteSize } from '@/domain/types'
import { SPRITE_MAX_ON_SCREEN, SPRITE_MAX_PER_LINE } from '@/domain/sprites'
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'

const open = defineModel<boolean>({ required: true })

const projects = useProjectsStore()
const editor = useEditorStore()

const CHOICES: { mode: G2CharsetMode; label: string; hint: string }[] = [
  { mode: 'mirrored', label: 'Mirrored', hint: 'one charset shared by all screen thirds' },
  { mode: 'independent', label: 'Independent', hint: 'a separate charset per screen third' },
]

const SIZE_CHOICES: { size: SpriteSize; label: string; hint: string }[] = [
  { size: 8, label: '8 × 8', hint: '256 sprites, one pattern each' },
  { size: 16, label: '16 × 16', hint: '64 sprites, four patterns each' },
]

const isSprite = computed(() => projects.current?.type === 'sprite')

const currentMode = computed<G2CharsetMode>(
  () => projects.current?.settings.g2CharsetMode ?? 'mirrored',
)

const selected = ref<G2CharsetMode>('mirrored')
const selectedSize = ref<SpriteSize>(8)

watch(open, (isOpen) => {
  if (!isOpen) return
  selected.value = currentMode.value
  selectedSize.value = editor.spriteSize
})

const isChanged = computed(() =>
  isSprite.value ? selectedSize.value !== editor.spriteSize : selected.value !== currentMode.value,
)
const isDestructive = computed(
  () =>
    !isSprite.value &&
    isChanged.value &&
    currentMode.value === 'independent' &&
    selected.value === 'mirrored',
)

function apply() {
  if (!isChanged.value) return
  if (isSprite.value) editor.setSpriteSize(selectedSize.value)
  else editor.setG2CharsetMode(selected.value)
  open.value = false
}
</script>

<template>
  <AppDialog v-model="open" title="Project Settings">
    <fieldset v-if="isSprite">
      <legend class="font-display mb-1 block text-sm tracking-wider text-ink-400">
        Sprite Size
      </legend>
      <div class="flex flex-col gap-1.5">
        <label
          v-for="choice in SIZE_CHOICES"
          :key="choice.size"
          class="flex cursor-pointer items-baseline justify-between gap-3 rounded-sm border px-3 py-2 transition-colors"
          :class="
            selectedSize === choice.size
              ? 'border-ink-300 bg-ink-800'
              : 'border-ink-700 bg-ink-850 hover:border-ink-500'
          "
        >
          <input
            v-model="selectedSize"
            type="radio"
            name="spriteSizeSetting"
            :value="choice.size"
            class="sr-only"
          />
          <span class="font-display text-base tracking-wider">{{ choice.label }}</span>
          <span class="text-xs text-ink-400">{{ choice.hint }}</span>
        </label>
      </div>

      <p v-if="isChanged" class="mt-2 text-xs text-ink-400">
        <template v-if="selectedSize === 16">
          Every four patterns become one 16×16 sprite, which takes the colour of the first of them.
          No pixels are lost.
        </template>
        <template v-else>
          Each 16×16 sprite splits into its four patterns, and all four keep the colour the sprite
          was showing. No pixels are lost; you can undo this while the project is open.
        </template>
      </p>

      <!-- Hardware facts about placement, which this mode doesn't model (Decision 33) -->
      <div class="mt-4 rounded-sm border border-ink-700 bg-ink-850 px-3 py-2 text-xs text-ink-400">
        <p class="font-display mb-1 tracking-wider text-ink-300">Hardware notes</p>
        <ul class="flex list-disc flex-col gap-0.5 pl-4">
          <li>
            {{ SPRITE_MAX_ON_SCREEN }} sprites on screen, but only {{ SPRITE_MAX_PER_LINE }} on any
            one scan line — the fifth and beyond vanish on that line.
          </li>
          <li>Lower sprite numbers draw in front of higher ones.</li>
          <li>A sprite coloured Transparent is invisible but still uses a per-line slot.</li>
          <li>Sprites work in Graphics I, Graphics II and Multicolor — never in Text Mode.</li>
        </ul>
      </div>
    </fieldset>

    <fieldset v-else>
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
        :label="isDestructive ? 'Convert & Discard' : isSprite ? 'Apply' : 'Convert'"
        show-label
        :disabled="!isChanged"
        @click="apply"
      >
        <Check class="size-4" />
      </AppButton>
    </template>
  </AppDialog>
</template>
