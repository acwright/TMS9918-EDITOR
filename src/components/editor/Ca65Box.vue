<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, Copy } from 'lucide-vue-next'
import AppButton from '@/components/base/AppButton.vue'
import { formatCharBytes } from '@/domain/ca65'
import type { CharPattern } from '@/domain/types'

const props = defineProps<{ pattern: CharPattern }>()

const text = computed(() => formatCharBytes(props.pattern))

const copied = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | undefined

async function copy() {
  await navigator.clipboard.writeText(text.value)
  copied.value = true
  clearTimeout(resetTimer)
  resetTimer = setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="flex items-center gap-1.5">
    <code
      class="flex h-9 flex-1 items-center rounded-sm border border-ink-700 bg-ink-900 px-2 font-mono text-[11px] whitespace-nowrap text-ink-300 select-all"
    >
      {{ text }}
    </code>
    <AppButton :label="copied ? 'Copied!' : 'Copy Bytes'" @click="copy">
      <Check v-if="copied" class="size-4 text-vdp-medium-green" />
      <Copy v-else class="size-4" />
    </AppButton>
  </div>
</template>
