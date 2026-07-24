import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  loadPreferences,
  savePreferences,
} from '../preferences'
import type { KVStorage } from '../repository'

describe('preferences', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns defaults when nothing is stored', () => {
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES)
  })

  it('round-trips a saved preference', () => {
    savePreferences({ labelCase: 'pascal' })
    expect(loadPreferences().labelCase).toBe('pascal')
  })

  it('merges patches instead of replacing the record', () => {
    savePreferences({ labelCase: 'camel' })
    expect(savePreferences({})).toEqual({ labelCase: 'camel' })
  })

  it('falls back to defaults for corrupt or unknown values', () => {
    localStorage.setItem(PREFERENCES_KEY, 'not json')
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES)
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ labelCase: 'kebab' }))
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES)
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(['nope']))
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES)
  })

  it('survives a storage that throws', () => {
    const broken: KVStorage = {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('full')
      },
      removeItem() {},
    }
    expect(loadPreferences(broken)).toEqual(DEFAULT_PREFERENCES)
    expect(savePreferences({ labelCase: 'upper' }, broken)).toEqual({ labelCase: 'upper' })
  })
})
