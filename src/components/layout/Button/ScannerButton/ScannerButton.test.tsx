import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useScannerContext } from 'utils/context/ScannerContext'
import ScannerButton from './ScannerButton'

vi.mock('d3', () => ({
  select: () => ({ empty: () => true }),
}))

vi.mock('utils/context/ScannerContext', () => ({
  useScannerContext: vi.fn(),
}))

function makeContext(overrides = {}) {
  return {
    showElementScanner: false,
    toggleElementScanner: vi.fn(),
    showCompoundScanner: false,
    toggleCompoundScanner: vi.fn(),
    showDerivedIndexScanner: false,
    toggleDerivedIndexScanner: vi.fn(),
    anyScannerOpen: false,
    ...overrides,
  } as any
}

beforeEach(() => {
  vi.mocked(useScannerContext).mockReturnValue(makeContext())
})

// ─── Button rendering ─────────────────────────────────────────────────────────

describe('button rendering', () => {
  it('renders the Scanner button', () => {
    render(<ScannerButton />)
    expect(screen.getByRole('button', { name: 'Scanner' })).toBeInTheDocument()
  })

  it('has no data-selected attribute when no scanner is open', () => {
    render(<ScannerButton />)
    expect(screen.getByRole('button', { name: 'Scanner' })).not.toHaveAttribute('data-selected')
  })

  it('has data-selected attribute when anyScannerOpen is true', () => {
    vi.mocked(useScannerContext).mockReturnValue(makeContext({ anyScannerOpen: true }))
    render(<ScannerButton />)
    expect(screen.getByRole('button', { name: 'Scanner' })).toHaveAttribute('data-selected')
  })
})

// ─── Popover ──────────────────────────────────────────────────────────────────

describe('popover', () => {
  it('shows all three toggle rows after clicking the button', async () => {
    render(<ScannerButton />)
    await userEvent.click(screen.getByRole('button', { name: 'Scanner' }))
    expect(screen.getByRole('button', { name: 'Chemical Elements' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Compound' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Derived Index' })).toBeInTheDocument()
  })

  it('calls toggleElementScanner with true when Chemical Elements is clicked', async () => {
    const toggleElementScanner = vi.fn()
    vi.mocked(useScannerContext).mockReturnValue(makeContext({ toggleElementScanner }))
    render(<ScannerButton />)
    await userEvent.click(screen.getByRole('button', { name: 'Scanner' }))
    await userEvent.click(screen.getByRole('button', { name: 'Chemical Elements' }))
    expect(toggleElementScanner).toHaveBeenCalledOnce()
    expect(toggleElementScanner).toHaveBeenCalledWith(true)
  })

  it('calls toggleCompoundScanner with true when Compound is clicked', async () => {
    const toggleCompoundScanner = vi.fn()
    vi.mocked(useScannerContext).mockReturnValue(makeContext({ toggleCompoundScanner }))
    render(<ScannerButton />)
    await userEvent.click(screen.getByRole('button', { name: 'Scanner' }))
    await userEvent.click(screen.getByRole('button', { name: 'Compound' }))
    expect(toggleCompoundScanner).toHaveBeenCalledOnce()
    expect(toggleCompoundScanner).toHaveBeenCalledWith(true)
  })

  it('calls toggleDerivedIndexScanner with true when Derived Index is clicked', async () => {
    const toggleDerivedIndexScanner = vi.fn()
    vi.mocked(useScannerContext).mockReturnValue(makeContext({ toggleDerivedIndexScanner }))
    render(<ScannerButton />)
    await userEvent.click(screen.getByRole('button', { name: 'Scanner' }))
    await userEvent.click(screen.getByRole('button', { name: 'Derived Index' }))
    expect(toggleDerivedIndexScanner).toHaveBeenCalledOnce()
    expect(toggleDerivedIndexScanner).toHaveBeenCalledWith(true)
  })
})

// ─── Toggle selected state ────────────────────────────────────────────────────

describe('toggle selected state', () => {
  it('marks Chemical Elements as pressed when showElementScanner is true', async () => {
    vi.mocked(useScannerContext).mockReturnValue(makeContext({ showElementScanner: true }))
    render(<ScannerButton />)
    await userEvent.click(screen.getByRole('button', { name: 'Scanner' }))
    expect(screen.getByRole('button', { name: 'Chemical Elements' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('marks Compound as pressed when showCompoundScanner is true', async () => {
    vi.mocked(useScannerContext).mockReturnValue(makeContext({ showCompoundScanner: true }))
    render(<ScannerButton />)
    await userEvent.click(screen.getByRole('button', { name: 'Scanner' }))
    expect(screen.getByRole('button', { name: 'Compound' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('marks Derived Index as pressed when showDerivedIndexScanner is true', async () => {
    vi.mocked(useScannerContext).mockReturnValue(makeContext({ showDerivedIndexScanner: true }))
    render(<ScannerButton />)
    await userEvent.click(screen.getByRole('button', { name: 'Scanner' }))
    expect(screen.getByRole('button', { name: 'Derived Index' })).toHaveAttribute('aria-pressed', 'true')
  })
})
