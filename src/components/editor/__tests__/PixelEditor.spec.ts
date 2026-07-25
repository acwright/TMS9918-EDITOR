import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PixelEditor from '../PixelEditor.vue'

/**
 * Mount with the grid rect stubbed to a fixed 80×80 box — 10px cells at 8×8,
 * 5px cells at 16×16.
 */
function mountEditor(options: { pixels?: boolean[]; size?: number } = {}) {
  const size = options.size ?? 8
  const pixels = options.pixels ?? Array.from({ length: size * size }, () => false)
  const colors = pixels.map((on) => (on ? 15 : 1))
  const wrapper = mount(PixelEditor, { props: { pixels, colors, size } })
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
    const { wrapper, grid } = mountEditor({ pixels: Array.from({ length: 64 }, () => true) })
    pointer(grid, 'pointerdown', { button: 2, clientX: 5, clientY: 5 })
    expect(wrapper.emitted('paint')?.[0]).toEqual([0, 0, false])
  })

  it('toggles against the pixel already under the pointer', () => {
    const pixels = Array.from({ length: 64 }, () => false)
    pixels[3 * 8 + 2] = true // cell (2, 3) is set
    const { wrapper, grid } = mountEditor({ pixels })
    pointer(grid, 'pointerdown', { button: 0, clientX: 25, clientY: 35 })
    expect(wrapper.emitted('paint')?.[0]).toEqual([2, 3, false])
  })

  it('ends the stroke on pointerup', () => {
    const { wrapper, grid } = mountEditor()
    pointer(grid, 'pointerdown', { button: 0, clientX: 5, clientY: 5 })
    window.dispatchEvent(new Event('pointerup'))
    expect(wrapper.emitted('strokeEnd')).toHaveLength(1)
  })

  describe('16×16 (sprites)', () => {
    it('renders 256 cells in 16 columns', () => {
      const { wrapper } = mountEditor({ size: 16 })
      const grid = wrapper.get('[aria-label^="Pixel editor"]')
      expect(grid.element.children).toHaveLength(256)
      expect((grid.element as HTMLElement).style.gridTemplateColumns).toBe(
        'repeat(16, minmax(0, 1fr))',
      )
    })

    it('maps pointer coordinates to 16 cells across the same box', () => {
      const { wrapper, grid } = mountEditor({ size: 16 })
      // 80px / 16 = 5px cells, so (52, 37) → cell (10, 7)
      pointer(grid, 'pointerdown', { button: 0, clientX: 52, clientY: 37 })
      expect(wrapper.emitted('paint')?.[0]).toEqual([10, 7, true])
    })

    it('reads the pixel state with 16-wide row stride', () => {
      const pixels = Array.from({ length: 256 }, () => false)
      pixels[7 * 16 + 10] = true // cell (10, 7)
      const { wrapper, grid } = mountEditor({ size: 16, pixels })
      pointer(grid, 'pointerdown', { button: 0, clientX: 52, clientY: 37 })
      expect(wrapper.emitted('paint')?.[0]).toEqual([10, 7, false])
    })

    it('draws the quadrant seams only when asked', () => {
      const plain = mount(PixelEditor, {
        props: { pixels: [], colors: [], size: 16 },
      })
      expect(plain.findAll('.bg-ink-300\\/40')).toHaveLength(0)

      const guided = mount(PixelEditor, {
        props: { pixels: [], colors: [], size: 16, quadrantGuides: true },
      })
      expect(guided.findAll('.bg-ink-300\\/40')).toHaveLength(2)
    })
  })
})
