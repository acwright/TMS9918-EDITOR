<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { Copy, Download, Pencil, Plus, Trash2, Upload, X } from 'lucide-vue-next'
import AppButton from '@/components/base/AppButton.vue'
import AppDialog from '@/components/base/AppDialog.vue'
import AppTextInput from '@/components/base/AppTextInput.vue'
import NewProjectDialog from '@/components/projects/NewProjectDialog.vue'
import { MODES } from '@/domain/modes'
import type { CreateProjectOptions } from '@/domain/factory'
import type { ProjectSummary } from '@/persistence/repository'
import { useProjectsStore } from '@/stores/projects'

const store = useProjectsStore()
const router = useRouter()

onMounted(() => store.refresh())

function openProject(id: string) {
  router.push(`/edit/${id}`)
}

// --- New project ---
const showNewProject = ref(false)

function onCreate(options: CreateProjectOptions) {
  const project = store.create(options)
  if (project) {
    showNewProject.value = false
    openProject(project.id)
  }
  // On failure the dialog stays open; the error banner explains why.
}

// --- Rename ---
const renameTarget = ref<ProjectSummary | null>(null)
const renameValue = ref('')

function startRename(summary: ProjectSummary) {
  renameTarget.value = summary
  renameValue.value = summary.name
}

function confirmRename() {
  const target = renameTarget.value
  const name = renameValue.value.trim()
  if (!target || !name) return
  if (store.rename(target.id, name)) renameTarget.value = null
}

// --- Delete ---
const deleteTarget = ref<ProjectSummary | null>(null)

function confirmDelete() {
  if (!deleteTarget.value) return
  store.remove(deleteTarget.value.id)
  deleteTarget.value = null
}

// --- Download / upload ---
function download(id: string) {
  const payload = store.exportProject(id)
  if (!payload) return
  const url = URL.createObjectURL(new Blob([payload.json], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = payload.filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const fileInput = useTemplateRef('fileInput')

async function onUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // allow re-uploading the same file
  if (!file) return
  store.importProject(await file.text())
}

// --- Formatting ---
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function formatDate(iso: string): string {
  const time = Date.parse(iso)
  return Number.isNaN(time) ? '—' : dateFormat.format(time)
}
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-3xl flex-col px-6 py-10">
    <header class="mb-8 flex items-end justify-between border-b border-ink-800 pb-4">
      <div>
        <h1 class="text-4xl">TMS9918 Editor</h1>
        <p class="text-sm text-ink-400">Character &amp; screen editor for the TMS9918 VDP</p>
      </div>
      <div class="flex gap-2">
        <AppButton label="Upload Project" @click="fileInput?.click()">
          <Upload class="size-4" />
        </AppButton>
        <AppButton label="New Project" shortcut="N" show-label @click="showNewProject = true">
          <Plus class="size-4" />
        </AppButton>
      </div>
    </header>

    <input
      ref="fileInput"
      type="file"
      accept=".json,application/json"
      class="hidden"
      @change="onUpload"
    />

    <div
      v-if="store.lastError"
      class="mb-4 flex items-center justify-between gap-3 rounded-sm border border-vdp-dark-red bg-vdp-dark-red/15 px-3 py-2 text-sm text-ink-100"
      role="alert"
    >
      <p>{{ store.lastError }}</p>
      <AppButton label="Dismiss" @click="store.dismissError()">
        <X class="size-4" />
      </AppButton>
    </div>

    <ul v-if="store.summaries.length" class="flex flex-col gap-2">
      <li
        v-for="summary in store.summaries"
        :key="summary.id"
        class="flex items-center gap-2 rounded-md border border-ink-800 bg-ink-900 p-2 transition-colors hover:border-ink-600"
      >
        <button
          type="button"
          class="flex min-w-0 flex-1 cursor-pointer items-baseline gap-3 rounded-sm px-2 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-300"
          @click="openProject(summary.id)"
        >
          <span class="font-display truncate text-2xl tracking-wider">{{ summary.name }}</span>
          <span
            class="shrink-0 rounded-xs border border-ink-600 px-1.5 py-0.5 text-[10px] tracking-wider text-ink-300 uppercase"
          >
            {{ MODES[summary.type].label }}
          </span>
          <span class="ml-auto shrink-0 text-xs text-ink-500">
            {{ formatDate(summary.modifiedAt) }}
          </span>
        </button>
        <div class="flex shrink-0 gap-1">
          <AppButton label="Rename" @click="startRename(summary)">
            <Pencil class="size-4" />
          </AppButton>
          <AppButton label="Duplicate" @click="store.duplicate(summary.id)">
            <Copy class="size-4" />
          </AppButton>
          <AppButton label="Download" @click="download(summary.id)">
            <Download class="size-4" />
          </AppButton>
          <AppButton label="Delete" @click="deleteTarget = summary">
            <Trash2 class="size-4" />
          </AppButton>
        </div>
      </li>
    </ul>

    <div
      v-else
      class="flex flex-1 flex-col items-center justify-center rounded-md border border-dashed border-ink-700 text-ink-500"
    >
      <p class="font-display text-2xl tracking-wider">No projects yet</p>
      <p class="text-sm">Create a new project or upload a saved one</p>
    </div>

    <NewProjectDialog v-model="showNewProject" @create="onCreate" />

    <AppDialog
      :model-value="renameTarget !== null"
      title="Rename Project"
      @update:model-value="renameTarget = null"
    >
      <form @submit.prevent="confirmRename">
        <AppTextInput v-model="renameValue" label="Name" autofocus />
      </form>
      <template #footer>
        <AppButton
          label="Rename"
          show-label
          :disabled="renameValue.trim().length === 0"
          @click="confirmRename"
        >
          <Pencil class="size-4" />
        </AppButton>
      </template>
    </AppDialog>

    <AppDialog
      :model-value="deleteTarget !== null"
      title="Delete Project"
      @update:model-value="deleteTarget = null"
    >
      <p class="text-sm text-ink-300">
        Delete <strong class="text-ink-100">{{ deleteTarget?.name }}</strong
        >? This cannot be undone — download it first if you want a copy.
      </p>
      <template #footer>
        <AppButton label="Cancel" show-label @click="deleteTarget = null" />
        <AppButton label="Delete" show-label @click="confirmDelete">
          <Trash2 class="size-4" />
        </AppButton>
      </template>
    </AppDialog>
  </div>
</template>
