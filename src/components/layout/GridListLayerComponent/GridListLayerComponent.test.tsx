import { render, screen } from '@testing-library/react'
import { GridListLayer, GridListLayerItem } from './GridListLayerComponent'

vi.mock('utils/context/LayerContext', () => ({
  useLayerContext: () => ({
    visibleLayers: new Set(),
    toggleLayerVisibility: vi.fn(),
  }),
}))

type Item = { id: string }

function renderItem(props: Partial<React.ComponentProps<typeof GridListLayerItem<Item>>> & {
  displayName: string
}) {
  const { displayName, ...rest } = props

  return render(
    <GridListLayer<Item> items={[{ id: 'layer-1' }]} aria-label="Layer Selection">
      {(item) => (
        <GridListLayerItem<Item>
          layerId={item.id}
          textValue={displayName}
          {...rest}
        >
          {displayName}
        </GridListLayerItem>
      )}
    </GridListLayer>
  )
}

// ─── Two-line title split ──────────────────────────────────────────────────

describe('title rendering', () => {
  it('splits displayName on the · separator into two lines', () => {
    renderItem({ displayName: 'Thorium Abundance · LP GRS' })

    expect(screen.getByText('Thorium Abundance')).toBeInTheDocument()
    expect(screen.getByText('LP GRS')).toBeInTheDocument()
  })

  it('renders a single line when displayName has no · separator', () => {
    renderItem({ displayName: 'Global Geological Map' })

    expect(screen.getByText('Global Geological Map')).toBeInTheDocument()
  })
})

// ─── Role icon ──────────────────────────────────────────────────────────────

const ROLE_TOOLTIPS = {
  Measured: 'Measured (direct instrument reading)',
  Modeled: 'Modeled (ML model, indirect signal)',
  Estimated: 'Estimated (computed from other layers)',
  Indicator: 'Indicator (proxy signal, not a real quantity)',
} as const

describe('role icon', () => {
  it('renders no role icon when role is not provided', () => {
    renderItem({ displayName: 'Global Geological Map' })

    Object.values(ROLE_TOOLTIPS).forEach((tooltip) => {
      expect(screen.queryByTitle(tooltip)).not.toBeInTheDocument()
    })
  })

  it.each([
    ['Measured', 'straighten'],
    ['Modeled', 'model_training'],
    ['Estimated', 'functions'],
    ['Indicator', 'sensors'],
  ] as const)('renders the %s icon with its own glyph and tooltip', (role, glyph) => {
    renderItem({ displayName: 'Thorium Abundance · LP GRS', role })

    const icon = screen.getByTitle(ROLE_TOOLTIPS[role])
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveTextContent(glyph)
  })
})
