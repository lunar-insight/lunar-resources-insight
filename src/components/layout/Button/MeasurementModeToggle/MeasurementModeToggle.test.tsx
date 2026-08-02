import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useMeasurementContext } from 'utils/context/MeasurementContext'
import MeasurementModeToggle from './MeasurementModeToggle'

vi.mock('utils/context/MeasurementContext', () => ({
  useMeasurementContext: vi.fn(),
}))

function makeContext(overrides = {}) {
  return {
    isActive: true,
    distanceMode: 'surface',
    setDistanceMode: vi.fn(),
    ...overrides,
  } as any
}

beforeEach(() => {
  vi.mocked(useMeasurementContext).mockReturnValue(makeContext())
})

describe('visibility', () => {
  it('renders nothing when the measurement tool is inactive', () => {
    vi.mocked(useMeasurementContext).mockReturnValue(makeContext({ isActive: false }))
    const { container } = render(<MeasurementModeToggle />)
    expect(container.firstChild).toBeNull()
  })

  it('renders both options when the tool is active', () => {
    render(<MeasurementModeToggle />)
    expect(screen.getByRole('button', { name: 'Direct distance' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Terrain distance' })).toBeInTheDocument()
  })
})

describe('selected state', () => {
  it('marks Direct as selected when distanceMode is surface', () => {
    render(<MeasurementModeToggle />)
    expect(screen.getByRole('button', { name: 'Direct distance' })).toHaveAttribute('data-selected')
    expect(screen.getByRole('button', { name: 'Terrain distance' })).not.toHaveAttribute('data-selected')
  })

  it('marks Terrain as selected when distanceMode is terrain', () => {
    vi.mocked(useMeasurementContext).mockReturnValue(makeContext({ distanceMode: 'terrain' }))
    render(<MeasurementModeToggle />)
    expect(screen.getByRole('button', { name: 'Terrain distance' })).toHaveAttribute('data-selected')
    expect(screen.getByRole('button', { name: 'Direct distance' })).not.toHaveAttribute('data-selected')
  })
})

describe('interaction', () => {
  it('calls setDistanceMode with "terrain" when Terrain is clicked', async () => {
    const setDistanceMode = vi.fn()
    vi.mocked(useMeasurementContext).mockReturnValue(makeContext({ setDistanceMode }))
    render(<MeasurementModeToggle />)
    await userEvent.click(screen.getByRole('button', { name: 'Terrain distance' }))
    expect(setDistanceMode).toHaveBeenCalledWith('terrain')
  })

  it('calls setDistanceMode with "surface" when Direct is clicked', async () => {
    const setDistanceMode = vi.fn()
    vi.mocked(useMeasurementContext).mockReturnValue(makeContext({ distanceMode: 'terrain', setDistanceMode }))
    render(<MeasurementModeToggle />)
    await userEvent.click(screen.getByRole('button', { name: 'Direct distance' }))
    expect(setDistanceMode).toHaveBeenCalledWith('surface')
  })
})
