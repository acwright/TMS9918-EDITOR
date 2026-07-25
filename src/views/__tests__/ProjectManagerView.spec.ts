import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import ProjectManagerView from '../ProjectManagerView.vue'
import { SAMPLES } from '@/samples'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn<() => void>() }) }))

/**
 * Mount the view, capturing anything Vue's error handling swallows. Errors
 * thrown in setup or in an immediate watcher never reach the caller — Vue
 * catches them — so without this hook a broken child mounts "successfully".
 */
function mountView() {
  localStorage.clear()
  setActivePinia(createPinia())
  const errors: unknown[] = []
  const wrapper = mount(ProjectManagerView, {
    global: { config: { errorHandler: (error: unknown) => errors.push(error) } },
  })
  return { wrapper, errors }
}

describe('ProjectManagerView', () => {
  beforeEach(() => {
    localStorage.clear()
    HTMLDialogElement.prototype.showModal = vi.fn<() => void>()
    HTMLDialogElement.prototype.close = vi.fn<() => void>()
  })

  it('mounts every child without one of them throwing', async () => {
    // Regression: ShareDialog's `immediate` watcher ran during setup and read
    // `copied`, which was declared 14 lines below it — a temporal-dead-zone
    // ReferenceError on every visit to the manager. Vue caught it, so it only
    // ever surfaced as a console error, and it shipped from v1.3.0 to v1.4.0.
    // The watcher is async, so its rejection settles a tick after mount.
    const { errors } = mountView()
    await flushPromises()
    expect(errors).toEqual([])
  })

  it('renders one card per bundled sample', () => {
    const grid = mountView().wrapper.get('[aria-label="Sample projects"]')
    expect(grid.findAll('button')).toHaveLength(SAMPLES.length)
  })

  it('lays the samples out in a single row at lg, however many there are', () => {
    // Regression: the column count was hard-coded at 4, so the fifth sample
    // (Sprite mode's Astro Ace) orphaned onto a row of its own.
    const grid = mountView().wrapper.get('[aria-label="Sample projects"]')
    expect(grid.attributes('style')).toContain(`--sample-cols: ${SAMPLES.length}`)
    expect(grid.classes()).toContain('lg:grid-cols-[repeat(var(--sample-cols),minmax(0,1fr))]')
  })
})
