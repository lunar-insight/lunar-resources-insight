import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ElementDatasetPicker, type DatasetCandidate } from './ElementDatasetPicker'

const candidates: DatasetCandidate[] = [
  { layerName: 'iron_primary', label: 'LP GRS', valueLabel: '7.60 wt%' },
  { layerName: 'iron_secondary', label: 'Kaguya XRS', valueLabel: '6.90 wt%' },
]

function renderPicker(overrides: Partial<React.ComponentProps<typeof ElementDatasetPicker>> = {}) {
  const onSelect = vi.fn()
  const utils = render(
    <ElementDatasetPicker
      symbolLabel="Fe"
      candidates={candidates}
      activeLayerName="iron_primary"
      onSelect={onSelect}
      {...overrides}
    />
  )
  return { onSelect, ...utils }
}

// ─── Trigger button ─────────────────────────────────────────────────────────

describe('trigger button', () => {
  it('renders with an aria-label naming the symbol', () => {
    renderPicker()
    expect(screen.getByRole('button', { name: 'Fe: choose which dataset feeds this bar' })).toBeInTheDocument()
  })

  it('renders a single trigger regardless of how many candidates are passed', () => {
    renderPicker({
      candidates: [
        ...candidates,
        { layerName: 'iron_tertiary', label: 'Prettyman2006', valueLabel: '8.10 wt%' },
      ],
    })
    expect(screen.getAllByRole('button', { name: /choose which dataset/i })).toHaveLength(1)
  })
})

// ─── Popover ────────────────────────────────────────────────────────────────

describe('popover', () => {
  it('opens on click and shows a heading naming the symbol', async () => {
    const user = userEvent.setup()
    renderPicker()
    await user.click(screen.getByRole('button', { name: /Fe: choose which dataset/i }))
    expect(screen.getByRole('heading', { name: 'Fe · choose dataset' })).toBeInTheDocument()
  })

  it('lists every candidate with its label and value', async () => {
    const user = userEvent.setup()
    renderPicker()
    await user.click(screen.getByRole('button', { name: /Fe: choose which dataset/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('LP GRS')).toBeInTheDocument()
    expect(within(dialog).getByText('7.60 wt%')).toBeInTheDocument()
    expect(within(dialog).getByText('Kaguya XRS')).toBeInTheDocument()
    expect(within(dialog).getByText('6.90 wt%')).toBeInTheDocument()
  })

  it('renders a pill for every candidate when there are more than two', async () => {
    const user = userEvent.setup()
    renderPicker({
      candidates: [
        ...candidates,
        { layerName: 'iron_tertiary', label: 'Prettyman2006', valueLabel: '8.10 wt%' },
      ],
    })
    await user.click(screen.getByRole('button', { name: /Fe: choose which dataset/i }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('LP GRS')).toBeInTheDocument()
    expect(within(dialog).getByText('Kaguya XRS')).toBeInTheDocument()
    expect(within(dialog).getByText('Prettyman2006')).toBeInTheDocument()
  })

  it('marks only the active candidate as active in its accessible name', async () => {
    const user = userEvent.setup()
    renderPicker({ activeLayerName: 'iron_secondary' })
    await user.click(screen.getByRole('button', { name: /Fe: choose which dataset/i }))

    expect(screen.getByRole('button', { name: 'Kaguya XRS, 6.90 wt%, active' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'LP GRS, 7.60 wt%' })).toBeInTheDocument()
  })

  it('treats the first candidate as active when activeLayerName matches none of them', async () => {
    const user = userEvent.setup()
    renderPicker({ activeLayerName: 'unknown_layer' })
    await user.click(screen.getByRole('button', { name: /Fe: choose which dataset/i }))

    expect(screen.getByRole('button', { name: 'LP GRS, 7.60 wt%, active' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kaguya XRS, 6.90 wt%' })).toBeInTheDocument()
  })
})

// ─── Selecting a candidate ──────────────────────────────────────────────────

describe('selecting a candidate', () => {
  it('calls onSelect with the clicked candidate layer id', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderPicker()
    await user.click(screen.getByRole('button', { name: /Fe: choose which dataset/i }))
    await user.click(screen.getByRole('button', { name: 'Kaguya XRS, 6.90 wt%' }))

    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSelect).toHaveBeenCalledWith('iron_secondary')
  })

  it('still calls onSelect when the already-active candidate is clicked', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderPicker()
    await user.click(screen.getByRole('button', { name: /Fe: choose which dataset/i }))
    await user.click(screen.getByRole('button', { name: 'LP GRS, 7.60 wt%, active' }))

    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSelect).toHaveBeenCalledWith('iron_primary')
  })
})

// ─── Positioning ────────────────────────────────────────────────────────────

describe('positioning', () => {
  it('applies the given style to the wrapper element', () => {
    const { container } = renderPicker({ style: { left: 42, top: 99 } })
    expect(container.firstElementChild).toHaveStyle({ left: '42px', top: '99px' })
  })
})
