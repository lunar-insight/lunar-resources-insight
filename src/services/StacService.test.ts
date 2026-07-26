import { getStacRole } from './StacService'

describe('getStacRole', () => {
  it('returns the lri:role value when present', () => {
    expect(getStacRole({ 'lri:role': 'Estimated' })).toBe('Estimated')
  })

  it('returns undefined when lri:role is absent', () => {
    expect(getStacRole({})).toBeUndefined()
  })
})
