import * as Cesium from 'cesium'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const openFeatureInspector = vi.fn()
const removeFeature = vi.fn()
vi.mock('utils/context/FeaturesContext', () => ({ useFeaturesContext: () => ({ openFeatureInspector, removeFeature }) }))

const closePopup = vi.fn()
vi.mock('utils/context/GlobePopupContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/context/GlobePopupContext')>()),
  useGlobePopup: () => ({ closePopup }),
}))

const copyCoordinates = vi.fn()
vi.mock('hooks/useCopyCoordinates', () => ({ useCopyCoordinates: () => copyCoordinates }))

import type { Feature } from '../types'
import FeatureCallout from './FeatureCallout'

const position = Cesium.Cartographic.fromDegrees(-32.08816, -18.2145371, -1500)

const viewer = {
  scene: {
    cartesianToCanvasCoordinates: vi.fn(() => new Cesium.Cartesian2(300, 200)),
    postRender: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
  },
  terrainProvider: undefined,
} as unknown as Cesium.Viewer

const makeFeature = (overrides: Partial<Feature> = {}): Feature => ({
  id: 'point-1',
  type: 'point',
  name: 'Point 4',
  entity: {} as Cesium.Entity,
  color: '#00FFFFFF',
  metadata: { position, createdAt: new Date() },
  inspectorOpen: false,
  visible: true,
  ...overrides,
})

const renderBox = (feature = makeFeature()) =>
  render(<FeatureCallout viewer={viewer} feature={feature} position={position} />)

beforeEach(() => {
  for (const mock of [openFeatureInspector, removeFeature, closePopup, copyCoordinates]) mock.mockClear()
})

it('shows the name and the coordinate above the point', () => {
  const { container } = renderBox()
  expect(screen.getByRole('dialog', { name: 'Point 4' })).toHaveTextContent('Point 4-18.214537, -32.088160')
  const anchor = container.firstChild as HTMLElement
  expect(anchor).toHaveAttribute('data-globe-popup')
  expect(anchor.style.transform).toBe('translate(300px, 200px) translate(-50%, -100%) translateY(-7px)')
})

it('opens the Inspector', async () => {
  renderBox()
  await userEvent.click(screen.getByRole('button', { name: 'Inspect' }))
  expect(openFeatureInspector).toHaveBeenCalledWith('point-1')
  expect(closePopup).toHaveBeenCalled()
})

it('copies the coordinate', async () => {
  renderBox()
  await userEvent.click(screen.getByRole('button', { name: 'Copy coordinates' }))
  expect(copyCoordinates).toHaveBeenCalledWith(expect.closeTo(-18.2145371, 6), expect.closeTo(-32.08816, 6))
  expect(closePopup).toHaveBeenCalled()
})

it('deletes the feature, named by its shape', async () => {
  renderBox(makeFeature({ type: 'two-point-circle' }))
  await userEvent.click(screen.getByRole('button', { name: 'Delete circle' }))
  expect(removeFeature).toHaveBeenCalledWith('point-1')
  expect(closePopup).toHaveBeenCalled()
})

it('closes', async () => {
  renderBox()
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(closePopup).toHaveBeenCalledTimes(1)
  expect(removeFeature).not.toHaveBeenCalled()
})

it('keeps the browser menu off the box', () => {
  renderBox()
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
  fireEvent(screen.getByRole('dialog'), event)
  expect(event.defaultPrevented).toBe(true)
})
