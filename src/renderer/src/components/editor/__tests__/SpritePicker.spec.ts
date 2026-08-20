import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { CreateProjectOptions } from '@/domain/factory'
import { loadPreferences } from '@/persistence/preferences'
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'
import { SPRITE_VIEWS } from '@/utils/spriteView'
import SpritePicker from '../SpritePicker.vue'

/**
 * The picker's layouts. The sheet scales the whole set into one square canvas,
 * which reads well with height to spare and turns each slot into 25 px without
 * it, so the layout is a choice — and one that outlives the session.
 *
 * jsdom draws nothing, so what these check is the layer around the canvas: how
 * many canvases a layout produces, what they are sized at, and what the rows
 * say.
 */
const context = {
  fillStyle: '',
  fillRect: vi.fn<(x: number, y: number, w: number, h: number) => void>(),
} as unknown as CanvasRenderingContext2D

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
})

function mountPicker(
  options: Partial<CreateProjectOptions> = {},
  { clearStorage = true }: { clearStorage?: boolean } = {},
) {
  if (clearStorage) localStorage.clear()
  setActivePinia(createPinia())
  const projects = useProjectsStore()
  const editor = useEditorStore()
  const project = projects.create({ name: 'Test', type: 'sprite', ...options })!
  projects.open(project.id)
  editor.reset()

  const wrapper = mount(SpritePicker, { global: { stubs: { ExportDialog: true } } })
  return { wrapper, projects, editor }
}

type Wrapper = ReturnType<typeof mountPicker>['wrapper']

const canvases = (wrapper: Wrapper) =>
  wrapper.findAll('canvas').map((c) => c.element as HTMLCanvasElement)

const layoutButtons = (wrapper: Wrapper) => wrapper.findAll('[aria-label="Sprite layout"] button')

/** Click the layout whose tooltip starts with `label`. */
async function choose(wrapper: Wrapper, label: string) {
  await layoutButtons(wrapper)
    .find((b) => b.attributes('aria-label')?.startsWith(label))!
    .trigger('click')
}

describe('SpritePicker layouts', () => {
  it('offers the three layouts, sheet selected by default', () => {
    const { wrapper } = mountPicker()
    expect(layoutButtons(wrapper)).toHaveLength(SPRITE_VIEWS.length)
    expect(layoutButtons(wrapper)[0]!.attributes('aria-checked')).toBe('true')

    const sheet = canvases(wrapper)
    expect(sheet).toHaveLength(1) // one square canvas for all 256 slots
    expect(sheet[0]!.width).toBe(128)
    expect(sheet[0]!.height).toBe(128)
    expect(sheet[0]!.getAttribute('aria-label')).toContain('Sprites 0–255')
  })

  it('draws a canvas per slot in the grid view', async () => {
    const { wrapper } = mountPicker()
    await choose(wrapper, 'Grid')

    const cells = wrapper.findAll('[data-slot]')
    expect(cells).toHaveLength(256)
    expect(cells[42]!.attributes('aria-label')).toBe('Sprite 42, $2A')
    expect(canvases(wrapper)[0]!.width).toBe(8) // one sprite, at its own size
    expect(wrapper.find('[aria-label="Sprites 0–255"]').exists()).toBe(true)
  })

  it('shrinks to 64 slots at 16×16, in every layout', async () => {
    const { wrapper } = mountPicker({ spriteSize: 16 })
    expect(canvases(wrapper)[0]!.width).toBe(128) // the sheet is square either way

    await choose(wrapper, 'Grid')
    expect(wrapper.findAll('[data-slot]')).toHaveLength(64)
    expect(canvases(wrapper)[0]!.width).toBe(16)

    await choose(wrapper, 'List')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(64)
  })

  it('lists every slot with its number in the list view', async () => {
    const { wrapper } = mountPicker()
    await choose(wrapper, 'List')

    const rows = wrapper.findAll('[role="option"]')
    expect(rows).toHaveLength(256)
    expect(rows[0]!.text()).toContain('#0 · $00')
    expect(rows[42]!.text()).toContain('#42 · $2A')
    expect(rows[0]!.attributes('aria-selected')).toBe('true')
  })

  it('selects through the store from every layout, and nothing else', async () => {
    const { wrapper, editor } = mountPicker()
    await choose(wrapper, 'Grid')
    await wrapper.findAll('[data-slot]')[9]!.trigger('click')
    expect(editor.selectedSprite).toBe(9)

    await choose(wrapper, 'List')
    await wrapper.findAll('[role="option"]')[17]!.trigger('click')
    expect(editor.selectedSprite).toBe(17)
  })

  it('remembers the layout across mounts', async () => {
    const { wrapper } = mountPicker()
    await choose(wrapper, 'List')
    expect(loadPreferences().spriteView).toBe('list')

    const again = mountPicker({}, { clearStorage: false })
    expect(again.wrapper.findAll('[role="option"]').length).toBe(256)
  })

  it('is independent of the character set’s layout', async () => {
    const { wrapper } = mountPicker()
    await choose(wrapper, 'Grid')
    expect(loadPreferences().spriteView).toBe('grid')
    expect(loadPreferences().charsetView).toBe('blocks') // untouched
  })

  it('keeps Settings and Export beside the layout toggle', () => {
    const { wrapper } = mountPicker()
    const labels = wrapper.findAll('button').map((b) => b.attributes('aria-label'))
    expect(labels).toContain('Sprite Settings')
    expect(labels).toContain('Export Sprites')
  })
})
