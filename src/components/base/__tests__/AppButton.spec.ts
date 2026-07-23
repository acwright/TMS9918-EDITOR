import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppButton from '../AppButton.vue'

describe('AppButton', () => {
  it('renders label as tooltip and aria-label, with shortcut key cap', () => {
    const wrapper = mount(AppButton, {
      props: { label: 'Undo', shortcut: 'Ctrl+Z' },
    })
    expect(wrapper.get('button').attributes('aria-label')).toBe('Undo')
    expect(wrapper.get('[role="tooltip"]').text()).toContain('Undo')
    expect(wrapper.get('kbd').text()).toBe('Ctrl+Z')
  })

  it('emits click and respects disabled', async () => {
    const wrapper = mount(AppButton, { props: { label: 'Fill' } })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)

    await wrapper.setProps({ disabled: true })
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  })

  it('reflects active state via aria-pressed', () => {
    const wrapper = mount(AppButton, { props: { label: 'Grid', active: true } })
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('true')
  })
})
