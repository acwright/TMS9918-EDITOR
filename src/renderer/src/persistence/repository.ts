/**
 * localStorage-backed project repository (PLAN.md §5 storage layout):
 * an index key listing project summaries, plus one key per project.
 *
 * Projects are stored as compact JSON (localStorage quota is ~5 MB and
 * charsets are large); pretty-printing is reserved for file downloads.
 * Corrupt entries are tolerated and skipped rather than crashing the app.
 */

import type { Project, ProjectType } from '@/domain/types'
import { validateProject } from '@/domain/serialization'
import { isProjectType } from '@/domain/modes'

export const INDEX_KEY = 'tms9918-editor:projects'

export function projectKey(id: string): string {
  return `tms9918-editor:project:${id}`
}

export interface ProjectSummary {
  id: string
  name: string
  type: ProjectType
  modifiedAt: string
}

/** Thrown when a write fails because browser storage is full. */
export class StorageQuotaError extends Error {
  constructor() {
    super(
      'Browser storage is full. Delete an unused project (download it first to keep a copy), then try again.',
    )
    this.name = 'StorageQuotaError'
  }
}

/** The subset of the DOM Storage interface the repository needs (injectable for tests). */
export interface KVStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface ProjectRepository {
  /** Project summaries, most recently modified first. */
  list(): ProjectSummary[]
  /** Load and validate a project; null if missing or corrupt. */
  load(id: string): Project | null
  /** Persist a project and update the index. Throws StorageQuotaError when full. */
  save(project: Project): void
  /** Remove a project and its index entry. */
  remove(id: string): void
}

export function createRepository(storage: KVStorage = localStorage): ProjectRepository {
  function readIndex(): ProjectSummary[] {
    const raw = storage.getItem(INDEX_KEY)
    if (!raw) return []
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(isSummary)
    } catch {
      return []
    }
  }

  function writeIndex(entries: ProjectSummary[]): void {
    setOrThrowQuota(INDEX_KEY, JSON.stringify(entries))
  }

  function setOrThrowQuota(key: string, value: string): void {
    try {
      storage.setItem(key, value)
    } catch {
      // Browsers disagree on the error type/name here; any setItem failure
      // in practice means the quota was exceeded.
      throw new StorageQuotaError()
    }
  }

  return {
    list() {
      return readIndex().sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
    },

    load(id) {
      const raw = storage.getItem(projectKey(id))
      if (!raw) return null
      try {
        return validateProject(JSON.parse(raw))
      } catch {
        return null
      }
    },

    save(project) {
      setOrThrowQuota(projectKey(project.id), JSON.stringify(project))
      const summary: ProjectSummary = {
        id: project.id,
        name: project.name,
        type: project.type,
        modifiedAt: project.modifiedAt,
      }
      writeIndex([...readIndex().filter((entry) => entry.id !== project.id), summary])
    },

    remove(id) {
      storage.removeItem(projectKey(id))
      writeIndex(readIndex().filter((entry) => entry.id !== id))
    },
  }
}

/**
 * Index entries that fail this guard are dropped on read, so the mode list must
 * never go stale — Round 3 hard-coded it and silently hid every saved multicolor
 * project (PLAN.md §14.7). `isProjectType` derives from `MODES`, so a new mode
 * is picked up automatically.
 */
function isSummary(value: unknown): value is ProjectSummary {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    isProjectType(s.type) &&
    typeof s.modifiedAt === 'string'
  )
}
