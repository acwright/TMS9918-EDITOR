import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PixelEditor from '../PixelEditor.vue'

const WHITE = { fg: 15, bg: 1 }
const rowColors = Array.from({ length: 8 }, () => WHITE)

/** Mount with the grid rect stubbed to a fixed 80×80 box (8 × 10px cells). */
function mountEditor(pattern: number[] = Array.from({ length: 8 }, () => 0)) {
  const wrapper = mount(PixelEditor, { props: { pattern, rowColors } })
  const grid = wrapper.get('[aria-label^="Pixel editor"]').element as HTMLElement
  vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 80,
    height: 80,
    right: 80,
    bottom: 80,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
  grid.setPointerCapture = vi.fn<(id: number) => void>() // jsdom has no pointer capture
  return { wrapper, grid }
}

/** Dispatch a pointer event (jsdom lacks PointerEvent; MouseEvent carries what we read). */
function pointer(el: HTMLElement, type: string, init: MouseEventInit) {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, ...init }))
}

describe('PixelEditor', () => {
  it('paints the cell under a pointerdown via coordinate math', async () => {
    const { wrapper, grid } = mountEditor()
    // (25, 35) → cell (2, 3)
    pointer(grid, 'pointerdown', { button: 0, clientX: 25, clientY: 35 })

    expect(wrapper.emitted('strokeStart')).toHaveLength(1)
    expect(wrapper.emitted('paint')?.[0]).toEqual([2, 3, true])
  })

  it('paints across cells on a drag (touch-style, no per-cell pointerenter)', async () => {
    const { wrapper, grid } = mountEditor()
    pointer(grid, 'pointerdown', { button: 0, clientX: 5, clientY: 5 }) // (0,0)
    pointer(grid, 'pointermove', { clientX: 15, clientY: 5 }) // (1,0)
    pointer(grid, 'pointermove', { clientX: 25, clientY: 5 }) // (2,0)

    expect(wrapper.emitted('paint')).toEqual([
      [0, 0, true],
      [1, 0, true],
      [2, 0, true],
    ])
  })

  it('does not re-emit while the pointer stays within one cell', async () => {
    const { wrapper, grid } = mountEditor()
    pointer(grid, 'pointerdown', { button: 0, clientX: 5, clientY: 5 })
    pointer(grid, 'pointermove', { clientX: 8, clientY: 8 }) // still (0,0)
    expect(wrapper.emitted('paint')).toHaveLength(1)
  })

  it('right-button drags erase', () => {
    const filled = Array.from({ length: 8 }, () => 0xff)
    const { wrapper, grid } = mountEditor(filled)
    pointer(grid, 'pointerdown', { button: 2, clientX: 5, clientY: 5 })
    expect(wrapper.emitted('paint')?.[0]).toEqual([0, 0, false])
  })

  it('ends the stroke on pointerup', () => {
    const { wrapper, grid } = mountEditor()
    pointer(grid, 'pointerdown', { button: 0, clientX: 5, clientY: 5 })
    window.dispatchEvent(new Event('pointerup'))
    expect(wrapper.emitted('strokeEnd')).toHaveLength(1)
  })
})
