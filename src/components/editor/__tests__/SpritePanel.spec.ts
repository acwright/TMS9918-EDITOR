import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import SpritePanel from '../SpritePanel.vue'
import PixelEditor from '../PixelEditor.vue'
import CharBytesBox from '../CharBytesBox.vue'
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'

/** Open a real sprite project so the panel wires against the actual store. */
function setup(spriteSize: 8 | 16 = 16) {
  localStorage.clear()
  setActivePinia(createPinia())
  const projects = useProjectsStore()
  const editor = useEditorStore()
  const project = projects.create({ name: 'S', type: 'sprite', spriteSize })!
  projects.open(project.id)
  editor.reset()
  return { projects, editor, wrapper: mount(SpritePanel) }
}

describe('SpritePanel', () => {
  beforeEach(() => localStorage.clear())

  it('drives the pixel editor at the project sprite size', () => {
    const { wrapper } = setup(16)
    const grid = wrapper.getComponent(PixelEditor)
    expect(grid.props('size')).toBe(16)
    expect(grid.props('pixels')).toHaveLength(256)
    expect(grid.props('colors')).toHaveLength(256)
    expect(grid.props('quadrantGuides')).toBe(true)
  })

  it('drops to 8×8 without quadrant guides', () => {
    const { wrapper } = setup(8)
    const grid = wrapper.getComponent(PixelEditor)
    expect(grid.props('size')).toBe(8)
    expect(grid.props('pixels')).toHaveLength(64)
    expect(grid.props('quadrantGuides')).toBe(false)
  })

  it('colours set pixels with the sprite colour and clear ones with the backdrop', async () => {
    const { editor, wrapper } = setup(16)
    editor.setSpriteColor(7)
    editor.setBackdrop(4)
    editor.paintPixel(9, 9, true) // bottom-right quadrant
    await wrapper.vm.$nextTick()

    const colors = wrapper.getComponent(PixelEditor).props('colors') as number[]
    expect(colors[9 * 16 + 9]).toBe(7)
    expect(colors[0]).toBe(4)
  })

  it('hands the byte box all 32 bytes of a 16×16 sprite', async () => {
    const { editor, wrapper } = setup(16)
    editor.paintPixel(8, 8, true) // → pattern 3, byte 0, bit 0x80
    await wrapper.vm.$nextTick()

    const bytes = wrapper.getComponent(CharBytesBox).props('bytes') as number[]
    expect(bytes).toHaveLength(32)
    expect(bytes[24]).toBe(0x80)
  })

  it('paints through to the store when the pixel editor emits', async () => {
    const { editor, wrapper } = setup(16)
    const grid = wrapper.getComponent(PixelEditor)
    grid.vm.$emit('strokeStart')
    grid.vm.$emit('paint', 2, 3, true)
    grid.vm.$emit('strokeEnd')

    expect(editor.currentSpriteGrid?.[3]?.[2]).toBe(true)
    expect(editor.undo()).toBe('Draw')
  })

  it('warns that a transparent sprite is invisible', async () => {
    const { editor, wrapper } = setup(8)
    expect(wrapper.text()).not.toContain('invisible')
    editor.setSpriteColor(0)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('invisible')
  })

  it('shows the hardware pattern name alongside the slot at 16×16', async () => {
    const { editor, wrapper } = setup(16)
    editor.selectSprite(3)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('#3 · pat 12')
  })
})
