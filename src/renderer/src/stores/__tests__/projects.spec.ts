import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { serializeProject } from '@/domain/serialization'
import { createProject } from '@/domain/factory'
import { decodeShare, readShareHash } from '@/domain/share'
import { AUTOSAVE_DELAY_MS, useProjectsStore } from '../projects'

describe('projects store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates a project and lists it', () => {
    const store = useProjectsStore()
    const project = store.create({ name: 'Alpha', type: 'graphics1' })
    expect(project).not.toBeNull()
    expect(store.summaries.map((s) => s.name)).toEqual(['Alpha'])
    expect(store.lastError).toBeNull()
  })

  it('opens and closes a project', () => {
    const store = useProjectsStore()
    const project = store.create({ name: 'Alpha', type: 'text' })!
    expect(store.open(project.id)?.name).toBe('Alpha')
    expect(store.current?.id).toBe(project.id)
    expect(store.saveState).toBe('saved')
    store.close()
    expect(store.current).toBeNull()
  })

  it('open returns null for a missing project', () => {
    const store = useProjectsStore()
    expect(store.open('missing')).toBeNull()
    expect(store.current).toBeNull()
  })

  it('renames a project', () => {
    const store = useProjectsStore()
    const project = store.create({ name: 'Alpha', type: 'text' })!
    expect(store.rename(project.id, 'Beta')).toBe(true)
    expect(store.summaries[0]?.name).toBe('Beta')
  })

  it('duplicates a project with a fresh id and name suffix', () => {
    const store = useProjectsStore()
    const project = store.create({ name: 'Alpha', type: 'graphics2' })!
    const copy = store.duplicate(project.id)!
    expect(copy.id).not.toBe(project.id)
    expect(copy.name).toBe('Alpha copy')
    expect(copy.charsets).toEqual(project.charsets)
    expect(store.summaries).toHaveLength(2)
  })

  it('removes a project and clears it if open', () => {
    const store = useProjectsStore()
    const project = store.create({ name: 'Alpha', type: 'text' })!
    store.open(project.id)
    store.remove(project.id)
    expect(store.summaries).toEqual([])
    expect(store.current).toBeNull()
  })

  describe('import / export', () => {
    it('round-trips through export and import', () => {
      const store = useProjectsStore()
      const project = store.create({ name: 'My Project!', type: 'graphics1' })!
      const payload = store.exportProject(project.id)!
      expect(payload.filename).toBe('my-project.tms9918.json')

      store.remove(project.id)
      const imported = store.importProject(payload.json)!
      expect(imported.id).toBe(project.id) // no collision — id kept
      expect(store.summaries.map((s) => s.name)).toEqual(['My Project!'])
    })

    it('assigns a fresh id when importing a colliding project', () => {
      const store = useProjectsStore()
      const project = store.create({ name: 'Alpha', type: 'text' })!
      const imported = store.importProject(serializeProject(project))!
      expect(imported.id).not.toBe(project.id)
      expect(store.summaries).toHaveLength(2)
    })

    it('rejects a malformed upload with a readable error', () => {
      const store = useProjectsStore()
      expect(store.importProject('{oops')).toBeNull()
      expect(store.lastError).toContain('Import failed')

      const invalid = { ...createProject({ name: 'X', type: 'text' }), version: 9 }
      expect(store.importProject(JSON.stringify(invalid))).toBeNull()
      expect(store.lastError).toContain('Unsupported project version')
    })
  })

  describe('share links', () => {
    it('builds a link that decodes back to the same project', async () => {
      const store = useProjectsStore()
      const project = store.create({ name: 'Shared', type: 'graphics1' })!
      const url = (await store.shareLink(project.id))!
      expect(url).toContain('#p=')

      const decoded = await decodeShare(readShareHash(new URL(url).hash)!)
      expect(decoded).toEqual(project)
    })

    it('reports a missing project instead of building a link', async () => {
      const store = useProjectsStore()
      expect(await store.shareLink('missing')).toBeNull()
      expect(store.lastError).toContain('could not be loaded')
    })

    it('adopts a shared project, keeping the local copy when ids collide', () => {
      const store = useProjectsStore()
      const project = store.create({ name: 'Alpha', type: 'text' })!
      const adopted = store.adopt(structuredClone(project))!
      expect(adopted.id).not.toBe(project.id)
      expect(store.summaries).toHaveLength(2)
    })
  })

  describe('autosave', () => {
    it('debounces markDirty into one save and updates modifiedAt', () => {
      vi.useFakeTimers()
      const store = useProjectsStore()
      const project = store.create({ name: 'Alpha', type: 'text' })!
      store.open(project.id)

      store.current!.name = 'Edited'
      store.markDirty()
      expect(store.saveState).toBe('unsaved')
      store.markDirty() // second call within the window re-debounces

      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1)
      expect(store.saveState).toBe('unsaved')
      vi.advanceTimersByTime(1)
      expect(store.saveState).toBe('saved')
      expect(store.summaries[0]?.name).toBe('Edited')
    })

    it('close flushes a pending autosave', () => {
      vi.useFakeTimers()
      const store = useProjectsStore()
      const project = store.create({ name: 'Alpha', type: 'text' })!
      store.open(project.id)

      store.current!.name = 'Flushed'
      store.markDirty()
      store.close()

      expect(store.summaries[0]?.name).toBe('Flushed')
      expect(store.current).toBeNull()
    })

    it('saveCurrent saves immediately', () => {
      const store = useProjectsStore()
      const project = store.create({ name: 'Alpha', type: 'text' })!
      store.open(project.id)
      store.current!.name = 'Now'
      expect(store.saveCurrent()).toBe(true)
      expect(store.saveState).toBe('saved')
      expect(store.summaries[0]?.name).toBe('Now')
    })
  })
})
