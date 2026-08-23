import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import * as spriteOps from '@/domain/spriteOps'
import type { SpriteSize } from '@/domain/types'
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'
import { openTestProject } from '@/testing/project'
import SpriteList from '../SpriteList.vue'

/**
 * The list view: the index of the sprite set, for the questions the sheet
 * can't answer — what is in slot $2A, which slots are still free, and which of
 * the empty-looking ones are invisible rather than blank.
 *
 * jsdom draws nothing, so what these check is the row around the canvas and the
 * listbox behaviour: one tab stop, arrows for the rest.
 */
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  localStorage.clear()
})

function mountList(spriteSize: SpriteSize = 8) {
  setActivePinia(createPinia())
  const projects = useProjectsStore()
  const editor = useEditorStore()
  openTestProject({ name: 'S', type: 'sprite', spriteSize })
  editor.reset()
  const wrapper = mount(SpriteList)
  return { wrapper, projects, editor }
}

type Wrapper = ReturnType<typeof mountList>['wrapper']

const rows = (wrapper: Wrapper) => wrapper.findAll('[role="option"]')

/** A key press on the listbox, as one arrives while it holds focus. */
function key(wrapper: Wrapper, value: string) {
  const event = new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })
  wrapper.get('[role="listbox"]').element.dispatchEvent(event)
  return event
}

describe('SpriteList', () => {
  it('shows one row per slot, with the number in both bases', () => {
    const { wrapper } = mountList()
    expect(rows(wrapper)).toHaveLength(256)
    expect(rows(wrapper)[42]!.text()).toContain('#42 · $2A')
  })

  it('names the patterns a slot occupies — one at 8×8, a quad at 16×16', () => {
    expect(rows(mountList(8).wrapper)[12]!.text()).toContain('pat 12')
    expect(rows(mountList(16).wrapper)[12]!.text()).toContain('pat 48–51')
  })

  it('names the colour, which the sheet can only paint', () => {
    const { wrapper, editor } = mountList()
    expect(rows(wrapper)[0]!.text()).toContain('White') // the default sprite colour
    editor.setSpriteColor(2)
    return wrapper.vm.$nextTick().then(() => {
      expect(rows(wrapper)[0]!.text()).toContain('Medium Green')
    })
  })

  it('distinguishes blank from invisible — the two the sheet can’t tell apart', async () => {
    const { wrapper, editor } = mountList()
    expect(rows(wrapper)[0]!.text()).toContain('Blank')
    expect(rows(wrapper)[0]!.text()).not.toContain('Invisible')

    editor.spriteTransform('Fill', (grid) => spriteOps.fill(grid.length)) // slot 0 now has pixels
    await wrapper.vm.$nextTick()
    expect(rows(wrapper)[0]!.text()).not.toContain('Blank')

    editor.setSpriteColor(0) // …but paints them in nothing
    await wrapper.vm.$nextTick()
    expect(rows(wrapper)[0]!.text()).toContain('Invisible')
    expect(rows(wrapper)[0]!.attributes('aria-label')).toContain('invisible')
  })

  it('counts every pattern of a 16×16 quad before calling a slot blank', async () => {
    const { wrapper, editor } = mountList(16)
    expect(rows(wrapper)[0]!.text()).toContain('Blank')

    editor.spriteTransform('Fill', (grid) => spriteOps.fill(grid.length))
    await wrapper.vm.$nextTick()
    expect(rows(wrapper)[0]!.text()).not.toContain('Blank')
    expect(rows(wrapper)[1]!.text()).toContain('Blank')
  })

  it('selects the clicked slot', async () => {
    const { wrapper, editor } = mountList()
    await rows(wrapper)[7]!.trigger('click')
    expect(editor.selectedSprite).toBe(7)
    expect(rows(wrapper)[7]!.attributes('aria-selected')).toBe('true')
  })

  it('keeps one tab stop, on the selected row', async () => {
    const { wrapper, editor } = mountList()
    expect(rows(wrapper).filter((r) => r.attributes('tabindex') === '0')).toHaveLength(1)

    editor.selectSprite(5)
    await wrapper.vm.$nextTick()
    expect(rows(wrapper)[5]!.attributes('tabindex')).toBe('0')
    expect(rows(wrapper)[0]!.attributes('tabindex')).toBe('-1')
  })

  it('walks the set with the arrows, a sheet row at a time with PageUp/Down', () => {
    const { wrapper, editor } = mountList()
    key(wrapper, 'ArrowDown')
    key(wrapper, 'ArrowDown')
    expect(editor.selectedSprite).toBe(2)
    key(wrapper, 'ArrowUp')
    expect(editor.selectedSprite).toBe(1)
    key(wrapper, 'PageDown')
    expect(editor.selectedSprite).toBe(17) // 16 slots a sheet row at 8×8
    key(wrapper, 'PageUp')
    expect(editor.selectedSprite).toBe(1)
    key(wrapper, 'End')
    expect(editor.selectedSprite).toBe(255)
    key(wrapper, 'ArrowDown') // the end is the end
    expect(editor.selectedSprite).toBe(255)
    key(wrapper, 'Home')
    expect(editor.selectedSprite).toBe(0)
  })

  it('pages by the 16×16 sheet’s eight-slot row, and ends at 63', () => {
    const { wrapper, editor } = mountList(16)
    key(wrapper, 'PageDown')
    expect(editor.selectedSprite).toBe(8)
    key(wrapper, 'End')
    expect(editor.selectedSprite).toBe(63)
  })

  it('keeps its keys away from the editor’s shortcut map', () => {
    const { wrapper } = mountList()
    expect(key(wrapper, 'ArrowDown').defaultPrevented).toBe(true)
    expect(key(wrapper, 'f').defaultPrevented).toBe(false) // still the Fill shortcut
  })

  it('opens on the selection, since switching layout is not a selection change', () => {
    setActivePinia(createPinia())
    const editor = useEditorStore()
    openTestProject({ name: 'S', type: 'sprite' })
    editor.reset()
    editor.selectSprite(90) // picked in the sheet, before this list existed

    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView')
    scrollIntoView.mockClear() // the spy outlives the test that installed it
    const wrapper = mount(SpriteList)

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    expect(scrollIntoView.mock.instances[0]).toBe(rows(wrapper)[90]!.element)
  })

  it('scrolls the selection into view when it changes from outside', async () => {
    const { wrapper, editor } = mountList()
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView')
    scrollIntoView.mockClear() // drop the reveal this list did on mount

    editor.selectSprite(200) // as `[` / `]` in EditorView would
    await wrapper.vm.$nextTick()

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    expect(scrollIntoView.mock.instances[0]).toBe(rows(wrapper)[200]!.element)
  })
})
