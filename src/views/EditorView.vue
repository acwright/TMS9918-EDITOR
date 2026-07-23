<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import AppButton from '../components/base/AppButton.vue'

defineProps<{ projectId: string }>()

const router = useRouter()
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
      <h1 class="text-2xl">Editor</h1>
      <span class="font-mono text-xs text-ink-500">{{ projectId }}</span>
    </header>

    <!-- Placeholder — Phases 4–7 build the editor panels here -->
    <main class="flex flex-1 items-center justify-center text-ink-500">
      <p class="font-display text-2xl tracking-wider">Editor arrives in Phases 4–7</p>
    </main>
  </div>
</template>
