<script setup lang="ts">
import { ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import AppButton from '../components/base/AppButton.vue'
import AppDialog from '../components/base/AppDialog.vue'

const showNewProject = ref(false)
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-3xl flex-col px-6 py-10">
    <header class="mb-8 flex items-end justify-between border-b border-ink-800 pb-4">
      <div>
        <h1 class="text-4xl">TMS9918 Editor</h1>
        <p class="text-sm text-ink-400">Character &amp; screen editor for the TMS9918 VDP</p>
      </div>
      <AppButton label="New Project" shortcut="N" show-label @click="showNewProject = true">
        <Plus class="size-4" />
      </AppButton>
    </header>

    <!-- Placeholder — Phase 3 replaces this with the real project list -->
    <div
      class="flex flex-1 flex-col items-center justify-center rounded-md border border-dashed border-ink-700 text-ink-500"
    >
      <p class="font-display text-2xl tracking-wider">No projects yet</p>
      <p class="text-sm">Project management arrives in Phase 3</p>
    </div>

    <AppDialog v-model="showNewProject" title="New Project">
      <p class="text-sm text-ink-400">
        Project creation arrives in Phase 3. This dialog verifies the base components.
      </p>
      <template #footer>
        <AppButton label="OK" show-label placement="top" @click="showNewProject = false" />
      </template>
    </AppDialog>
  </div>
</template>
