import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import AnimationPanel from '../AnimationPanel.vue'
import { useEditorStore } from '@/stores/editor'
import { useProjectsStore } from '@/stores/projects'
import { openTestProject } from '@/testing/project'

/** Captured rAF callbacks, so the playback loop can be driven frame by frame. */
let frames: FrameRequestCallback[] = []

function setup() {
  localStorage.clear()
  setActivePinia(createPinia())
  const projects = useProjectsStore()
  const editor = useEditorStore()
  openTestProject({ name: 'S', type: 'sprite', spriteSize: 16 })
  editor.reset()
  return { projects, editor, wrapper: mount(AnimationPanel) }
}

/** Run one animation frame at `now` milliseconds. */
function advance(now: number) {
  const pending = frames
  frames = []
  for (const frame of pending) frame(now)
}

describe('AnimationPanel', () => {
  beforeEach(() => {
    frames = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    // The loop seeds its clock from performance.now(); pin it to zero so the
    // timestamps below are absolute rather than relative to however long the
    // test process has been running.
    vi.spyOn(performance, 'now').mockReturnValue(0)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('advances the playhead at the animation frame rate', async () => {
    const { editor, wrapper } = setup()
    editor.addFrame(1)
    editor.addFrame(2) // frames [0, 1, 2]
    editor.setAnimationFps(0, 10) // 100ms per frame
    editor.selectFrame(0)

    editor.setPlaying(true)
    await wrapper.vm.$nextTick()
    expect(frames.length).toBeGreaterThan(0)

    advance(1000) // 1000ms since the clock was seeded at 0 — well past due
    expect(editor.selectedFrame).toBe(1)

    advance(1050) // 50ms — too soon at 10fps
    expect(editor.selectedFrame).toBe(1)

    advance(1100) // 100ms — next frame
    expect(editor.selectedFrame).toBe(2)

    advance(1200)
    expect(editor.selectedFrame).toBe(0) // wraps
  })

  it('stops requesting frames once paused', async () => {
    const { editor, wrapper } = setup()
    editor.addFrame(1)
    editor.setPlaying(true)
    await wrapper.vm.$nextTick()

    editor.setPlaying(false)
    await wrapper.vm.$nextTick()
    frames = []
    advance(1000)
    expect(frames).toHaveLength(0)
  })

  it('stops playback when unmounted', async () => {
    const { editor, wrapper } = setup()
    editor.addFrame(1)
    editor.setPlaying(true)
    await wrapper.vm.$nextTick()

    wrapper.unmount()
    expect(editor.playing).toBe(false)
  })

  it('disables play below two frames', async () => {
    const { editor, wrapper } = setup()
    const play = wrapper.find('[aria-label^="Play"]')
    expect(play.attributes('disabled')).toBeDefined()

    editor.addFrame(1)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[aria-label^="Play"]').attributes('disabled')).toBeUndefined()
  })

  it('shows the animation name and paginator position', async () => {
    const { editor, wrapper } = setup()
    expect(wrapper.text()).toContain('Animation 1')
    expect(wrapper.text()).toContain('1/1')

    editor.addAnimation()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('2/2')
  })

  it('reports the on-screen size, magnification included', async () => {
    const { editor, wrapper } = setup()
    expect(wrapper.text()).toContain('16×16 on screen')

    editor.setSpriteMag(2)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('32×32 on screen')
  })

  it('says when the preview is falling back to the edited sprite', async () => {
    const { editor, wrapper } = setup()
    expect(wrapper.text()).not.toContain('showing the edited sprite')

    editor.removeFrame(0) // no frames left
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('showing the edited sprite')
  })

  it('steps frames manually, pausing playback first', async () => {
    const { editor, wrapper } = setup()
    editor.addFrame(1) // frames [0, 1]; adding moves the playhead onto the new frame
    editor.selectFrame(0)
    editor.setPlaying(true)
    await wrapper.vm.$nextTick()

    await wrapper.get('[aria-label^="Next Frame"]').trigger('click')
    expect(editor.playing).toBe(false)
    expect(editor.selectedFrame).toBe(1)

    await wrapper.get('[aria-label^="Previous Frame"]').trigger('click')
    expect(editor.selectedFrame).toBe(0)
  })

  it('drives the preview zoom through the store, so the +/- shortcuts reach it', async () => {
    const { editor, wrapper } = setup()
    expect(wrapper.text()).toContain('6×')

    await wrapper.get('[aria-label^="Zoom In"]').trigger('click')
    expect(editor.previewScale).toBe(7)

    editor.zoomPreview(-3) // as the keyboard shortcut would
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('4×')

    editor.zoomPreview(-99)
    expect(editor.previewScale).toBe(1) // clamped
    editor.zoomPreview(99)
    // 32, not 12: the preview stage is 32 logical pixels square, so 12× tops out
    // at 384px — short of filling a tablet or a desktop column.
    expect(editor.previewScale).toBe(editor.MAX_PREVIEW_SCALE)
    expect(editor.MAX_PREVIEW_SCALE).toBe(32)
  })

  it('drives the frame rate from the toolbar', async () => {
    const { editor, wrapper } = setup()
    expect(wrapper.text()).toContain('8 fps')

    await wrapper.get('[aria-label^="Faster"]').trigger('click')
    expect(editor.currentAnimation?.fps).toBe(9)

    await wrapper.get('[aria-label^="Slower"]').trigger('click')
    expect(editor.currentAnimation?.fps).toBe(8)
  })
})
