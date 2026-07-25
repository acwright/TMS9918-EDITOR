import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import ExportDialog from '../ExportDialog.vue'
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'

/** Open a real sprite project and mount the dialog in sprite scope. */
function setup(spriteSize: 8 | 16 = 16) {
  localStorage.clear()
  setActivePinia(createPinia())
  const projects = useProjectsStore()
  const editor = useEditorStore()
  const project = projects.create({ name: 'Astro Ace', type: 'sprite', spriteSize })!
  projects.open(project.id)
  editor.reset()
  const wrapper = mount(ExportDialog, {
    props: { modelValue: true, scope: 'sprite' as const },
  })
  return { projects, editor, wrapper }
}

/** Click a segmented option button by its visible label. */
async function click(wrapper: ReturnType<typeof mount>, label: string) {
  const button = wrapper.findAll('button').find((b) => b.text() === label)
  if (!button) throw new Error(`no button labelled "${label}"`)
  await button.trigger('click')
}

describe('ExportDialog (sprite scope)', () => {
  beforeEach(() => {
    localStorage.clear()
    // jsdom has no showModal(); the dialog only needs it not to throw.
    HTMLDialogElement.prototype.showModal = vi.fn<() => void>()
    HTMLDialogElement.prototype.close = vi.fn<() => void>()
  })

  it('titles itself for sprites', () => {
    const { wrapper } = setup()
    expect(wrapper.text()).toContain('Export Sprites')
  })

  it('previews ca65 with the sprite tables and the current animation', async () => {
    const { editor, wrapper } = setup(16)
    editor.addFrame(2) // frames [0, 2]
    await wrapper.vm.$nextTick()

    const preview = wrapper.get('textarea').element.value
    expect(preview).toContain('sprite_patterns:')
    expect(preview).toContain('sprite_colors:')
    expect(preview).toContain('sprite_anim_animation_1:')
    // 16×16 frames emit slot × 4 as the SAT pattern name.
    expect(preview).toMatch(/sprite_anim_animation_1:\s*\n\s*\.byte \$00, \$08/)
  })

  it('pluralises the frame count in the segment header', async () => {
    const { editor, wrapper } = setup()
    expect(wrapper.get('textarea').element.value).toContain('(1 frame @ 8 fps)')

    editor.addFrame(1)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('textarea').element.value).toContain('(2 frames @ 8 fps)')
  })

  it('drops a table from the output when its toggle is off', async () => {
    const { wrapper } = setup()
    await click(wrapper, 'Colours')
    expect(wrapper.get('textarea').element.value).not.toContain('sprite_colors:')

    await click(wrapper, 'Patterns')
    expect(wrapper.get('textarea').element.value).not.toContain('sprite_patterns:')
  })

  it('exports only the current animation when asked', async () => {
    const { editor, wrapper } = setup()
    editor.addFrame(1)
    editor.addAnimation() // a second animation, now selected
    editor.addFrame(3)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('textarea').element.value).toContain('sprite_anim_animation_1:')
    await click(wrapper, 'Current')
    const preview = wrapper.get('textarea').element.value
    expect(preview).toContain('sprite_anim_animation_2:')
    expect(preview).not.toContain('sprite_anim_animation_1:')
  })

  it('reports the sprite-sheet size and the film-strip size for PNG', async () => {
    const { editor, wrapper } = setup(16)
    await click(wrapper, 'PNG')
    expect(wrapper.text()).toContain('512 × 512 px') // 128 sheet × 4×
    expect(wrapper.text()).toContain('astro-ace-sprites.png')

    editor.addFrame(1) // frames [0, 1]
    await click(wrapper, 'Film Strip')
    await wrapper.vm.$nextTick()
    // 2 frames × 32px stage × 4× = 256 wide, 128 tall
    expect(wrapper.text()).toContain('256 × 128 px')
    expect(wrapper.text()).toContain('astro-ace-sprites-animation-1.png')
  })

  it('refuses a film strip of an empty animation but allows the sheet', async () => {
    const { editor, wrapper } = setup()
    editor.removeFrame(0) // no frames left
    await click(wrapper, 'PNG')
    await click(wrapper, 'Film Strip')
    await wrapper.vm.$nextTick()

    const download = wrapper.findAll('button').find((b) => b.text() === 'Download')!
    expect(download.attributes('disabled')).toBeDefined()

    await click(wrapper, 'Sprite Sheet')
    await wrapper.vm.$nextTick()
    expect(
      wrapper
        .findAll('button')
        .find((b) => b.text() === 'Download')!
        .attributes('disabled'),
    ).toBeUndefined()
  })

  it('reports the binary byte count for the selected tables', async () => {
    const { wrapper } = setup(16)
    await click(wrapper, 'Binary')
    // 2048 pattern bytes + 64 colour bytes (16×16) + 1 frame
    expect(wrapper.text()).toContain('2113 bytes')
    expect(wrapper.text()).toContain('astro-ace-sprites.bin')
  })
})
