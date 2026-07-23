import { beforeEach, describe, expect, it } from 'vitest'
import { createProject } from '@/domain/factory'
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
