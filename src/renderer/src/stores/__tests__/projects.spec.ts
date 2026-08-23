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

  it('creates a project and lists it', async () => {
    const store = useProjectsStore()
    const project = await store.create({ name: 'Alpha', type: 'graphics1' })
    expect(project).not.toBeNull()
    expect(store.summaries.map((s) => s.name)).toEqual(['Alpha'])
    expect(store.lastError).toBeNull()
  })

  it('opens and closes a project', async () => {
    const store = useProjectsStore()
    const project = (await store.create({ name: 'Alpha', type: 'text' }))!
    expect((await store.open(project.id))?.name).toBe('Alpha')
    expect(store.current?.id).toBe(project.id)
    expect(store.saveState).toBe('saved')
    await store.close()
    expect(store.current).toBeNull()
  })

  it('open resolves to null for a missing project', async () => {
    const store = useProjectsStore()
    expect(await store.open('missing')).toBeNull()
    expect(store.current).toBeNull()
  })

  it('a second open wins, however the loads interleave', async () => {
    // Awaiting a load means a fast second navigation can land while the first
    // is still in flight; the stale one must not overwrite what is now open.
    const store = useProjectsStore()
    const first = (await store.create({ name: 'First', type: 'text' }))!
    const second = (await store.create({ name: 'Second', type: 'text' }))!

    const stale = store.open(first.id)
    const fresh = store.open(second.id)
    await Promise.all([stale, fresh])

    expect(store.current?.id).toBe(second.id)
  })

  it('renames a project', async () => {
    const store = useProjectsStore()
    const project = (await store.create({ name: 'Alpha', type: 'text' }))!
    expect(await store.rename(project.id, 'Beta')).toBe(true)
    expect(store.summaries[0]?.name).toBe('Beta')
  })

  it('renames the open project in memory as well as in storage', async () => {
    const store = useProjectsStore()
    const project = (await store.create({ name: 'Alpha', type: 'text' }))!
    await store.open(project.id)
    await store.rename(project.id, 'Beta')
    expect(store.current?.name).toBe('Beta')
  })

  it('reports a rename of a project that is gone', async () => {
    const store = useProjectsStore()
    expect(await store.rename('missing', 'Beta')).toBe(false)
    expect(store.lastError).toContain('Renaming')
  })

  it('duplicates a project with a fresh id and name suffix', async () => {
    const store = useProjectsStore()
    const project = (await store.create({ name: 'Alpha', type: 'graphics2' }))!
    const copyId = (await store.duplicate(project.id))!
    expect(copyId).not.toBe(project.id)

    const copy = (await store.open(copyId))!
    expect(copy.name).toBe('Alpha copy')
    expect(copy.charsets).toEqual(project.charsets)
    expect(store.summaries).toHaveLength(2)
  })

  it('removes a project and clears it if open', async () => {
    const store = useProjectsStore()
    const project = (await store.create({ name: 'Alpha', type: 'text' }))!
    await store.open(project.id)
    await store.remove(project.id)
    expect(store.summaries).toEqual([])
    expect(store.current).toBeNull()
  })

  describe('import / export', () => {
    it('round-trips through export and import', async () => {
      const store = useProjectsStore()
      const project = (await store.create({ name: 'My Project!', type: 'graphics1' }))!
      const payload = (await store.exportProject(project.id))!
      // The document name, not a slug and not the compound v1 extension: a
      // download and a document are the same file now (D3, F7).
      expect(payload.filename).toBe('My Project!.tms9918')

      await store.remove(project.id)
      const imported = (await store.importProject(payload.json))!
      expect(imported.id).toBe(project.id) // no collision — id kept
      expect(store.summaries.map((s) => s.name)).toEqual(['My Project!'])
    })

    it('assigns a fresh id when importing a colliding project', async () => {
      const store = useProjectsStore()
      const project = (await store.create({ name: 'Alpha', type: 'text' }))!
      const imported = (await store.importProject(serializeProject(project)))!
      expect(imported.id).not.toBe(project.id)
      expect(store.summaries).toHaveLength(2)
    })

    it('rejects a malformed upload with a readable error', async () => {
      const store = useProjectsStore()
      expect(await store.importProject('{oops')).toBeNull()
      expect(store.lastError).toContain('Import failed')

      const invalid = { ...createProject({ name: 'X', type: 'text' }), version: 9 }
      expect(await store.importProject(JSON.stringify(invalid))).toBeNull()
      expect(store.lastError).toContain('Unsupported project version')
    })
  })

  describe('share links', () => {
    it('builds a link that decodes back to the same project', async () => {
      const store = useProjectsStore()
      const project = (await store.create({ name: 'Shared', type: 'graphics1' }))!
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

    it('adopts a shared project, keeping the local copy when ids collide', async () => {
      const store = useProjectsStore()
      const project = (await store.create({ name: 'Alpha', type: 'text' }))!
      const adopted = (await store.adopt(structuredClone(project)))!
      expect(adopted.id).not.toBe(project.id)
      expect(store.summaries).toHaveLength(2)
    })
  })

  describe('autosave', () => {
    it('debounces markDirty into one save and updates modifiedAt', async () => {
      vi.useFakeTimers()
      const store = useProjectsStore()
      const project = (await store.create({ name: 'Alpha', type: 'text' }))!
      await store.open(project.id)

      store.current!.name = 'Edited'
      store.markDirty()
      expect(store.saveState).toBe('unsaved')
      store.markDirty() // second call within the window re-debounces

      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1)
      expect(store.saveState).toBe('unsaved')
      await vi.advanceTimersByTimeAsync(1)
      expect(store.saveState).toBe('saved')
      expect(store.summaries[0]?.name).toBe('Edited')
    })

    it('close flushes a pending autosave', async () => {
      vi.useFakeTimers()
      const store = useProjectsStore()
      const project = (await store.create({ name: 'Alpha', type: 'text' }))!
      await store.open(project.id)

      store.current!.name = 'Flushed'
      store.markDirty()
      await store.close()

      expect(store.summaries[0]?.name).toBe('Flushed')
      expect(store.current).toBeNull()
    })

    it('saveCurrent saves immediately', async () => {
      const store = useProjectsStore()
      const project = (await store.create({ name: 'Alpha', type: 'text' }))!
      await store.open(project.id)
      store.current!.name = 'Now'
      expect(await store.saveCurrent()).toBe(true)
      expect(store.saveState).toBe('saved')
      expect(store.summaries[0]?.name).toBe('Now')
    })

    it('flushAutosave resolves only once the write has landed', async () => {
      // The before-quit path (App.vue) waits on this and then tells main it is
      // safe to close, so "resolved" has to mean "written", not "scheduled".
      const store = useProjectsStore()
      const project = (await store.create({ name: 'Alpha', type: 'text' }))!
      await store.open(project.id)

      store.current!.name = 'Quitting'
      store.markDirty()
      await store.flushAutosave()

      expect(store.saveState).toBe('saved')
      expect(store.summaries[0]?.name).toBe('Quitting')
    })

    it('flushAutosave waits for a save that is already in flight', async () => {
      const store = useProjectsStore()
      const project = (await store.create({ name: 'Alpha', type: 'text' }))!
      await store.open(project.id)

      store.current!.name = 'In flight'
      const inFlight = store.saveCurrent()
      const flushed = store.flushAutosave()
      await Promise.all([inFlight, flushed])

      expect(store.saveState).toBe('saved')
      expect(store.summaries[0]?.name).toBe('In flight')
    })

    it('flushing with nothing to save is a no-op that still resolves', async () => {
      const store = useProjectsStore()
      await expect(store.flushAutosave()).resolves.toBeUndefined()
    })
  })

  describe('unchanged saves (D5)', () => {
    it('writes nothing, and stamps nothing, when the project has not changed', async () => {
      const store = useProjectsStore()
      const project = (await store.create({ name: 'Alpha', type: 'text' }))!
      await store.open(project.id)
      const stamp = store.current!.modifiedAt

      const setItem = vi.spyOn(localStorage, 'setItem')
      expect(await store.saveCurrent()).toBe(true)

      expect(setItem).not.toHaveBeenCalled()
      expect(store.current!.modifiedAt).toBe(stamp)
      expect(store.saveState).toBe('saved')
      setItem.mockRestore()
    })

    it('writes, and stamps, as soon as a pixel moves', async () => {
      vi.useFakeTimers()
      const store = useProjectsStore()
      const project = (await store.create({ name: 'Alpha', type: 'text' }))!
      await store.open(project.id)
      const stamp = store.current!.modifiedAt

      // Far enough that the ISO stamp is bound to differ.
      vi.setSystemTime(new Date(Date.parse(stamp) + 60_000))
      store.current!.charsets[0]![0]![0] = 1
      expect(await store.saveCurrent()).toBe(true)

      expect(store.current!.modifiedAt).not.toBe(stamp)
      const reopened = (await store.open(project.id))!
      expect(reopened.charsets[0]![0]![0]).toBe(1)
    })

    it('a second save of the same edit writes once', async () => {
      const store = useProjectsStore()
      const project = (await store.create({ name: 'Alpha', type: 'text' }))!
      await store.open(project.id)

      store.current!.name = 'Edited'
      await store.saveCurrent()
      const stamp = store.current!.modifiedAt

      const setItem = vi.spyOn(localStorage, 'setItem')
      await store.saveCurrent()
      expect(setItem).not.toHaveBeenCalled()
      expect(store.current!.modifiedAt).toBe(stamp)
      setItem.mockRestore()
    })
  })
})
