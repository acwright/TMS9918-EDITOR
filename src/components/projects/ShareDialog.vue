<script setup lang="ts">
import { ref, watch } from 'vue'
import { Check, Copy } from 'lucide-vue-next'
import AppButton from '@/components/base/AppButton.vue'
import AppDialog from '@/components/base/AppDialog.vue'
import { SHARE_LENGTH_WARNING } from '@/domain/share'
import { useProjectsStore } from '@/stores/projects'

const props = defineProps<{ projectId: string | null; projectName: string }>()
const open = defineModel<boolean>({ required: true })

const store = useProjectsStore()

const link = ref('')
const building = ref(false)

// Rebuild whenever the dialog opens (the project may have changed since last time)
watch(
  () => [open.value, props.projectId] as const,
  async ([isOpen, id]) => {
    link.value = ''
    copied.value = false
    if (!isOpen || !id) return
    building.value = true
    link.value = (await store.shareLink(id)) ?? ''
    building.value = false
    if (!link.value) open.value = false // the error banner explains why
  },
  { immediate: true },
)

const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined

async function copy() {
  if (!link.value) return
  await navigator.clipboard.writeText(link.value)
  copied.value = true
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <AppDialog v-model="open" size="lg" title="Share Project">
    <div class="flex flex-col gap-3">
      <p class="text-sm text-ink-300">
        This link carries all of <strong class="text-ink-100">{{ projectName }}</strong> — every
        character set, colour and screen — compressed into the URL itself. Nothing is uploaded
        anywhere; whoever opens it gets their own copy.
      </p>

      <input
        :value="building ? 'Building link…' : link"
        readonly
        spellcheck="false"
        aria-label="Share link"
        class="w-full rounded-sm border border-ink-700 bg-ink-950 px-2.5 py-2 font-mono text-xs text-ink-300 focus:border-ink-300 focus:outline-none"
        @focus="($event.target as HTMLInputElement).select()"
      />

      <p v-if="link.length > SHARE_LENGTH_WARNING" class="text-xs text-vdp-dark-yellow">
        {{ link.length.toLocaleString() }} characters — long enough that some chat apps and link
        previews truncate it. Send the downloaded <code>.tms9918.json</code> file instead if it
        arrives broken.
      </p>
      <p v-else-if="link" class="text-xs text-ink-500">
        {{ link.length.toLocaleString() }} characters.
      </p>
    </div>

    <template #footer>
      <AppButton label="Copy Link" show-label :disabled="!link" @click="copy">
        <Check v-if="copied" class="size-4 text-vdp-medium-green" />
        <Copy v-else class="size-4" />
      </AppButton>
    </template>
  </AppDialog>
</template>
