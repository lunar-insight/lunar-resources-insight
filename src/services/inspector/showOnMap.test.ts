// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { showOnMapState } from './showOnMap'

const base = { selected: true, visible: true, fromInspector: false, activeVariant: 0, variantLabels: [] as string[] }

describe('showOnMapState', () => {
  it('adds a layer not in the list', () => {
    expect(showOnMapState({ ...base, selected: false, visible: false })).toEqual({
      pressed: false, action: 'add', label: 'Show on the map', tooltip: 'Show on the map',
    })
  })

  it('shows a hidden layer', () => {
    expect(showOnMapState({ ...base, visible: false })).toEqual({
      pressed: false, action: 'show', label: 'Show on the map', tooltip: 'Show on the map',
    })
  })

  it('removes a shown layer it added and nothing adjusted', () => {
    expect(showOnMapState({ ...base, fromInspector: true })).toEqual({
      pressed: true, action: 'remove', label: 'On the map', tooltip: 'Remove from the map',
    })
  })

  it('hides a shown layer from the menus or adjusted', () => {
    expect(showOnMapState(base)).toEqual({
      pressed: true, action: 'hide', label: 'On the map', tooltip: 'Hide it (stays in Layer Management)',
    })
  })

  it('swaps a layer on another variant, stating both', () => {
    expect(showOnMapState({ ...base, activeVariant: 1, variantLabels: ['2°', '5°'] })).toEqual({
      pressed: false,
      action: 'swap',
      label: 'Show 2° on the map',
      tooltip: 'The map shows the 5° variant. This value is read from 2°.',
    })
  })

  it('swaps a hidden layer on another variant too', () => {
    expect(showOnMapState({ ...base, visible: false, activeVariant: 1, variantLabels: ['2°', '5°'] }).action).toBe('swap')
  })

  it('takes the first variant as the one read', () => {
    expect(showOnMapState({ ...base, fromInspector: true, activeVariant: 0, variantLabels: ['2°', '5°'] }).action).toBe('remove')
  })
})
