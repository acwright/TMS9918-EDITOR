import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { CreateProjectOptions } from '@/domain/factory'
import { loadPreferences } from '@/persistence/preferences'
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'
import { CHARSET_VIEWS } from '@/utils/charsetView'
import { openTestProject } from '@/testing/project'
import CharsetPicker from '../CharsetPicker.vue'

/**
 * The picker's layouts. Blocks scales the whole set to the space it is given,
 * which reads well with height to spare and collapses to a sliver without it,
 * so the layout is a choice — and one that outlives the session.
 *
 * jsdom draws nothing, so what these check is the layer around the canvas: how
 * many grids a layout produces, how tall each is, and what the list says.
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
  openTestProject({ name: 'Test', type: 'graphics1', ...options })
  editor.reset()

  const wrapper = mount(CharsetPicker, { global: { stubs: { ExportDialog: true } } })
  return { wrapper, projects, editor }
}

type Wrapper = ReturnType<typeof mountPicker>['wrapper']

const canvases = (wrapper: Wrapper) =>
  wrapper.findAll('canvas').map((c) => c.element as HTMLCanvasElement)

const layoutButtons = (wrapper: Wrapper) =>
  wrapper.findAll('[aria-label="Character set layout"] button')

/** Click the layout whose tooltip starts with `label`. */
async function choose(wrapper: Wrapper, label: string) {
  await layoutButtons(wrapper)
    .find((b) => b.attributes('aria-label')?.startsWith(label))!
    .trigger('click')
}

describe('CharsetPicker layouts', () => {
  it('offers the three layouts, blocks selected by default', () => {
    const { wrapper } = mountPicker()
    expect(layoutButtons(wrapper)).toHaveLength(CHARSET_VIEWS.length)
    expect(layoutButtons(wrapper)[0]!.attributes('aria-checked')).toBe('true')

    const grids = canvases(wrapper)
    expect(grids).toHaveLength(2) // the two 128-glyph halves
    expect(grids[0]!.getAttribute('aria-label')).toContain('Characters 0–127')
    expect(grids[1]!.getAttribute('aria-label')).toContain('Characters 128–255')
    expect(grids[0]!.height).toBe(16 * 8) // 16 rows of 8-pixel characters
  })

  it('draws the whole set as one width-fitted grid in the grid view', async () => {
    const { wrapper } = mountPicker()
    await choose(wrapper, 'Grid')

    const grids = canvases(wrapper)
    expect(grids).toHaveLength(1)
    expect(grids[0]!.getAttribute('aria-label')).toContain('Characters 0–255')
    expect(grids[0]!.height).toBe(32 * 8) // 256 glyphs, eight a row
    expect(grids[0]!.className).toContain('w-full')
  })

  it('keeps Text Mode’s 6-pixel cells in the grid view', async () => {
    const { wrapper } = mountPicker({ type: 'text' })
    await choose(wrapper, 'Grid')
    expect(canvases(wrapper)[0]!.width).toBe(8 * 6)
  })

  it('lists every character with its code in the list view', async () => {
    const { wrapper } = mountPicker()
    await choose(wrapper, 'List')

    const rows = wrapper.findAll('[role="option"]')
    expect(rows).toHaveLength(256)
    expect(rows[0]!.text()).toContain('#0 · $00')
    expect(rows[42]!.text()).toContain('#42 · $2A')
    expect(rows[0]!.attributes('aria-selected')).toBe('true')
  })

  it('remembers the layout across mounts', async () => {
    const { wrapper } = mountPicker()
    await choose(wrapper, 'List')
    expect(loadPreferences().charsetView).toBe('list')

    const again = mountPicker({}, { clearStorage: false })
    expect(again.wrapper.findAll('[role="option"]').length).toBe(256)
  })

  it('keeps the Graphics II set buttons beside the layout toggle', () => {
    const { wrapper } = mountPicker({ type: 'graphics2', g2CharsetMode: 'independent' })
    const labels = wrapper.findAll('button').map((b) => b.attributes('aria-label'))
    expect(labels).toContain('Set 1 (Top Third)')
    expect(layoutButtons(wrapper)).toHaveLength(CHARSET_VIEWS.length)
  })
})
