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

  it('keeps the full displayName as the title attribute for the native tooltip', () => {
    renderItem({ displayName: 'Thorium Abundance · LP GRS' })

    expect(screen.getByTitle('Thorium Abundance · LP GRS')).toBeInTheDocument()
  })
})

// ─── Element / compound badge ──────────────────────────────────────────────

describe('badge rendering', () => {
  it('renders the element symbol when element is provided', () => {
    renderItem({ displayName: 'Thorium Abundance · LP GRS', element: 'thorium' })

    expect(screen.getByLabelText('thorium')).toHaveTextContent('Th')
  })

  it('renders the compound formula when compound is provided', () => {
    renderItem({ displayName: 'FeO Abundance · Clementine CNN', compound: 'feo' })

    expect(screen.getByLabelText('feo')).toHaveTextContent('FeO')
  })

  it('renders no badge when neither element nor compound is provided', () => {
    const { container } = renderItem({ displayName: 'Global Geological Map' })

    expect(container.querySelector('[class*="elBadge"]')).not.toBeInTheDocument()
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

// ─── Row element order ──────────────────────────────────────────────────────
// The row reads left to right: drag handle, visibility checkbox, badge, title
// block, role icon, accordion trigger, remove button.

function isBefore(a: Element, b: Element): boolean {
  return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
}

describe('row element order', () => {
  it('places badge, title, role icon, accordion trigger and remove button in that order', () => {
    const { container } = renderItem({
      displayName: 'Thorium Abundance · LP GRS',
      element: 'thorium',
      role: 'Measured',
      accordionContent: <div>Accordion content</div>,
    })

    const badge = container.querySelector('[class*="elBadge"]')
    const titleBlock = container.querySelector('[class*="gridListItemHeaderItemText"]')
    const roleIconEl = screen.getByTitle(ROLE_TOOLTIPS.Measured)
    const accordionTrigger = container.querySelector('[class*="gridListItemHeaderAccordionHeader"]')
    const removeWrapper = container.querySelector('[class*="gridListItemHeaderRemoveLayerWrapper"]')

    expect(badge).toBeTruthy()
    expect(titleBlock).toBeTruthy()
    expect(accordionTrigger).toBeTruthy()
    expect(removeWrapper).toBeTruthy()

    expect(isBefore(badge!, titleBlock!)).toBe(true)
    expect(isBefore(titleBlock!, roleIconEl)).toBe(true)
    expect(isBefore(roleIconEl, accordionTrigger!)).toBe(true)
    expect(isBefore(accordionTrigger!, removeWrapper!)).toBe(true)
  })
})
