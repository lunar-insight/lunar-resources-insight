import { render, screen } from '@testing-library/react'
import CoordinatesDisplay from './CoordinatesDisplay'

// ─── Visibility guard ─────────────────────────────────────────────────────────

describe('when not visible', () => {
  it('renders nothing when isVisible is false', () => {
    const { container } = render(
      <CoordinatesDisplay latitude={10} longitude={20} isVisible={false} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when latitude is null', () => {
    const { container } = render(
      <CoordinatesDisplay latitude={null} longitude={20} isVisible={true} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when longitude is null', () => {
    const { container } = render(
      <CoordinatesDisplay latitude={10} longitude={null} isVisible={true} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})

// ─── Latitude formatting ──────────────────────────────────────────────────────

describe('latitude formatting', () => {
  it('formats positive latitude with 6 decimal places', () => {
    render(<CoordinatesDisplay latitude={45.123456} longitude={0} isVisible={true} />)
    expect(screen.getByText('45.123456°')).toBeInTheDocument()
  })

  it('formats negative latitude with 6 decimal places', () => {
    render(<CoordinatesDisplay latitude={-12.5} longitude={0} isVisible={true} />)
    expect(screen.getByText('-12.500000°')).toBeInTheDocument()
  })

  it('formats zero latitude', () => {
    render(<CoordinatesDisplay latitude={0} longitude={10} isVisible={true} />)
    expect(screen.getByText('0.000000°')).toBeInTheDocument()
  })
})

// ─── Longitude formatting ─────────────────────────────────────────────────────

describe('longitude formatting', () => {
  it('formats positive longitude as-is', () => {
    render(<CoordinatesDisplay latitude={0} longitude={90.5} isVisible={true} />)
    expect(screen.getByText('90.500000°')).toBeInTheDocument()
  })

  it('normalizes negative longitude by adding 360', () => {
    render(<CoordinatesDisplay latitude={0} longitude={-45} isVisible={true} />)
    expect(screen.getByText('315.000000°')).toBeInTheDocument()
  })

  it('formats zero longitude', () => {
    render(<CoordinatesDisplay latitude={0} longitude={0} isVisible={true} />)
    // 0 is not negative so no normalization
    expect(screen.getAllByText('0.000000°')).toHaveLength(2)
  })
})
