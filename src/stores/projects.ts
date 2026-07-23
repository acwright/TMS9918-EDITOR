/**
 * Projects store — the project list, the currently open project, and
 * debounced autosave with a dirty flag (drives the Phase 8 save indicator).
 *
 * Mutating actions return null (and set `lastError`) instead of throwing, so
 * views have a single error surface to present.
 */

import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Project } from '@/domain/types'
import { createProject, type CreateProjectOptions } from '@/domain/factory'
import {
  ProjectValidationError,
  deserializeProject,
  serializeProject,
} from '@/domain/serialization'
import { StorageQuotaError, createRepository, type ProjectSummary } from '@/persistence/repository'

export type SaveState = 'saved' | 'saving' | 'unsaved'

export const AUTOSAVE_DELAY_MS = 500

export const useProjectsStore = defineStore('projects', () => {
  const repository = createRepository()

  const summaries = ref<ProjectSummary[]>([])
  const current = ref<Project | null>(null)
  const saveState = ref<SaveState>('saved')
  /** Latest storage/validation failure, for the manager view's error banner. */
  const lastError = ref<string | null>(null)

  let autosaveTimer: ReturnType<typeof setTimeout> | undefined

  function refresh(): void {
    summaries.value = repository.list()
  }

  /** Persist a project; on failure record the error and report false. */
  function persist(project: Project): boolean {
    try {
      repository.save(project)
      lastError.value = null
      return true
    } catch (error) {
      lastError.value =
        error instanceof StorageQuotaError ? error.message : 'Saving the project failed.'
      return false
    }
  }

  function create(options: CreateProjectOptions): Project | null {
    const project = createProject(options)
    if (!persist(project)) return null
    refresh()
    return project
  }

  function open(id: string): Project | null {
    flushAutosave()
    const project = repository.load(id)
    current.value = project
    saveState.value = 'saved'
    return project
  }

  function close(): void {
    flushAutosave()
    current.value = null
    saveState.value = 'saved'
  }

  function rename(id: string, name: string): boolean {
    const project = current.value?.id === id ? current.value : repository.load(id)
    if (!project) return false
    project.name = name
    project.modifiedAt = new Date().toISOString()
    if (!persist(project)) return false
    refresh()
    return true
  }

  function duplicate(id: string): Project | null {
    const source = repository.load(id)
    if (!source) return null
    const now = new Date().toISOString()
    const copy: Project = {
      ...structuredClone(source),
      id: crypto.randomUUID(),
      name: `${source.name} copy`,
      createdAt: now,
      modifiedAt: now,
    }
    if (!persist(copy)) return null
    refresh()
    return copy
  }

  function remove(id: string): void {
    repository.remove(id)
    if (current.value?.id === id) {
      current.value = null
      saveState.value = 'saved'
    }
    refresh()
  }

  /** Import an uploaded project JSON file. Assigns a fresh id on collision. */
  function importProject(json: string): Project | null {
    let project: Project
    try {
      project = deserializeProject(json)
    } catch (error) {
      lastError.value =
        error instanceof ProjectValidationError
          ? `Import failed: ${error.message}`
          : 'Import failed: unreadable file.'
      return null
    }
    if (repository.load(project.id)) {
      project.id = crypto.randomUUID()
    }
    if (!persist(project)) return null
    refresh()
    return project
  }

  /** Pretty-printed download payload for a project. */
  function exportProject(id: string): { filename: string; json: string } | null {
    const project = current.value?.id === id ? current.value : repository.load(id)
    if (!project) return null
    const slug =
      project.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'project'
    return { filename: `${slug}.tms9918.json`, json: serializeProject(project) }
  }

  /** Mark the open project dirty and schedule a debounced autosave. */
  function markDirty(): void {
    if (!current.value) return
    saveState.value = 'unsaved'
    clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(saveCurrent, AUTOSAVE_DELAY_MS)
  }

  /** Save the open project immediately (Ctrl/Cmd+S, close, tab hide). */
  function saveCurrent(): boolean {
    clearTimeout(autosaveTimer)
    autosaveTimer = undefined
    if (!current.value) return true
    saveState.value = 'saving'
    current.value.modifiedAt = new Date().toISOString()
    const ok = persist(current.value)
    saveState.value = ok ? 'saved' : 'unsaved'
    if (ok) refresh()
    return ok
  }

  function flushAutosave(): void {
    if (saveState.value === 'unsaved' || autosaveTimer !== undefined) {
      saveCurrent()
    }
  }

  function dismissError(): void {
    lastError.value = null
  }

  return {
    summaries,
    current,
    saveState,
    lastError,
    refresh,
    create,
    open,
    close,
    rename,
    duplicate,
    remove,
    importProject,
    exportProject,
    markDirty,
    saveCurrent,
    dismissError,
  }
})
