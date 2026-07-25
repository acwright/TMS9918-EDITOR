import { beforeEach, describe, expect, it } from 'vitest'
import { createProject } from '@/domain/factory'
import { PROJECT_TYPES } from '@/domain/modes'
import {
  INDEX_KEY,
  StorageQuotaError,
  createRepository,
  projectKey,
  type KVStorage,
} from '../repository'

describe('repository', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts empty', () => {
    expect(createRepository().list()).toEqual([])
  })

  it('saves, lists, and loads a project', () => {
    const repository = createRepository()
    const project = createProject({ name: 'Alpha', type: 'graphics1' })
    repository.save(project)

    expect(repository.list()).toEqual([
      { id: project.id, name: 'Alpha', type: 'graphics1', modifiedAt: project.modifiedAt },
    ])
    expect(repository.load(project.id)).toEqual(project)
  })

  it('lists and loads a multicolor project (index summary accepts the type)', () => {
    const repository = createRepository()
    const project = createProject({ name: 'MC', type: 'multicolor' })
    repository.save(project)

    // Regression: the index summary guard once rejected 'multicolor', so the
    // entry was silently dropped on every read and never appeared in the manager.
    expect(repository.list()).toEqual([
      { id: project.id, name: 'MC', type: 'multicolor', modifiedAt: project.modifiedAt },
    ])
    expect(repository.load(project.id)).toEqual(project)
  })

  it.each(PROJECT_TYPES)('lists and loads a %s project', (type) => {
    const repository = createRepository()
    const project = createProject({ name: 'P', type })
    repository.save(project)

    // Regression: the index summary guard hard-coded its mode list and once
    // rejected 'multicolor', silently dropping the entry on every read
    // (PLAN.md §14.7). It now derives from MODES, so this covers every mode.
    expect(repository.list()).toEqual([
      { id: project.id, name: 'P', type, modifiedAt: project.modifiedAt },
    ])
    expect(repository.load(project.id)).toEqual(project)
  })

  it('still drops index entries naming an unknown mode', () => {
    const repository = createRepository()
    localStorage.setItem(
      INDEX_KEY,
      JSON.stringify([{ id: 'x', name: 'Bogus', type: 'graphics3', modifiedAt: 'now' }]),
    )
    expect(repository.list()).toEqual([])
  })

  it('updates the index entry on re-save instead of duplicating it', () => {
    const repository = createRepository()
    const project = createProject({ name: 'Alpha', type: 'text' })
    repository.save(project)
    repository.save({ ...project, name: 'Renamed' })

    const index = repository.list()
    expect(index).toHaveLength(1)
    expect(index[0]?.name).toBe('Renamed')
  })

  it('lists most recently modified first', () => {
    const repository = createRepository()
    const older = createProject({ name: 'Old', type: 'text' })
    const newer = createProject({ name: 'New', type: 'text' })
    repository.save({ ...older, modifiedAt: '2026-01-01T00:00:00.000Z' })
    repository.save({ ...newer, modifiedAt: '2026-06-01T00:00:00.000Z' })

    expect(repository.list().map((s) => s.name)).toEqual(['New', 'Old'])
  })

  it('removes a project and its index entry', () => {
    const repository = createRepository()
    const project = createProject({ name: 'Gone', type: 'text' })
    repository.save(project)
    repository.remove(project.id)

    expect(repository.list()).toEqual([])
    expect(repository.load(project.id)).toBeNull()
    expect(localStorage.getItem(projectKey(project.id))).toBeNull()
  })

  it('returns null for a missing project', () => {
    expect(createRepository().load('nope')).toBeNull()
  })

  it('tolerates a corrupt index', () => {
    localStorage.setItem(INDEX_KEY, '{oops')
    expect(createRepository().list()).toEqual([])
    localStorage.setItem(INDEX_KEY, JSON.stringify([{ bogus: true }, 42]))
    expect(createRepository().list()).toEqual([])
  })

  it('returns null for a corrupt or invalid stored project', () => {
    localStorage.setItem(projectKey('bad-json'), '{oops')
    expect(createRepository().load('bad-json')).toBeNull()

    localStorage.setItem(projectKey('bad-shape'), JSON.stringify({ version: 99 }))
    expect(createRepository().load('bad-shape')).toBeNull()
  })

  it('throws StorageQuotaError when the storage is full', () => {
    const full: KVStorage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError')
      },
      removeItem: () => {},
    }
    const repository = createRepository(full)
    const project = createProject({ name: 'Big', type: 'graphics2' })
    expect(() => repository.save(project)).toThrowError(StorageQuotaError)
  })
})
