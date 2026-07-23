<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import AppButton from '@/components/base/AppButton.vue'
import { MODES } from '@/domain/modes'
import { useProjectsStore } from '@/stores/projects'

const props = defineProps<{ projectId: string }>()

const router = useRouter()
const store = useProjectsStore()

watch(
  () => props.projectId,
  (id) => store.open(id),
  { immediate: true },
)
onBeforeUnmount(() => store.close())

const SAVE_STATE_LABEL = { saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved' } as const
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="flex h-12 items-center gap-3 border-b border-ink-800 bg-ink-900 px-3">
      <AppButton
        label="Back to Projects"
        shortcut="Esc"
        placement="bottom"
        @click="router.push('/')"
      >
        <ArrowLeft class="size-4" />
      </AppButton>
      <template v-if="store.current">
        <h1 class="truncate text-2xl">{{ store.current.name }}</h1>
        <span
          class="shrink-0 rounded-xs border border-ink-600 px-1.5 py-0.5 text-[10px] tracking-wider text-ink-300 uppercase"
        >
          {{ MODES[store.current.type].label }}
        </span>
        <span class="ml-auto shrink-0 text-xs text-ink-500">
          {{ SAVE_STATE_LABEL[store.saveState] }}
        </span>
      </template>
    </header>

    <!-- Placeholder — Phases 4–7 build the editor panels here -->
    <main class="flex flex-1 items-center justify-center text-ink-500">
      <p v-if="store.current" class="font-display text-2xl tracking-wider">
        Editor arrives in Phases 4–7
      </p>
      <div v-else class="text-center">
        <p class="font-display text-2xl tracking-wider">Project not found</p>
        <p class="text-sm">It may have been deleted or this link is stale.</p>
      </div>
    </main>
  </div>
</template>
