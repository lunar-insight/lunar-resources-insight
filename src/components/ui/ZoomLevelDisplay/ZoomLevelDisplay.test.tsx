import { render, screen } from '@testing-library/react'
import ZoomLevelDisplay from './ZoomLevelDisplay'

// ─── Null guard ───────────────────────────────────────────────────────────────

describe('when height is null', () => {
  it('renders nothing', () => {
    const { container } = render(<ZoomLevelDisplay height={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})

// ─── Meters ───────────────────────────────────────────────────────────────────

describe('meters range (< 1000)', () => {
  it('formats a value in meters', () => {
    render(<ZoomLevelDisplay height={500} />)
    expect(screen.getByText('500.00 m')).toBeInTheDocument()
  })

  it('formats the upper boundary of meters (999.99)', () => {
    render(<ZoomLevelDisplay height={999.99} />)
    expect(screen.getByText('999.99 m')).toBeInTheDocument()
  })
})

// ─── Kilometres ───────────────────────────────────────────────────────────────

describe('kilometres range (≥ 1 000 and < 1 000 000)', () => {
  it('formats exactly 1000 m as km', () => {
    render(<ZoomLevelDisplay height={1000} />)
    expect(screen.getByText('1.00 km')).toBeInTheDocument()
  })

  it('formats a mid-range km value', () => {
    render(<ZoomLevelDisplay height={150000} />)
    expect(screen.getByText('150.00 km')).toBeInTheDocument()
  })

  it('formats the upper boundary of km (999 999)', () => {
    render(<ZoomLevelDisplay height={999999} />)
    expect(screen.getByText('1000.00 km')).toBeInTheDocument()
  })
})

// ─── Megametres ───────────────────────────────────────────────────────────────

describe('megametres range (≥ 1 000 000)', () => {
  it('formats exactly 1 000 000 m as Mm', () => {
    render(<ZoomLevelDisplay height={1000000} />)
    expect(screen.getByText('1.00 Mm')).toBeInTheDocument()
  })

  it('formats a large Mm value', () => {
    render(<ZoomLevelDisplay height={3500000} />)
    expect(screen.getByText('3.50 Mm')).toBeInTheDocument()
  })
})
