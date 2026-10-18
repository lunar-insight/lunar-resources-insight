import * as Cesium from 'cesium'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { inputActions, handlerDestroy } = vi.hoisted(() => ({
  inputActions: {} as Record<string, (event: { position: { x: number; y: number } }) => void>,
  handlerDestroy: vi.fn(),
}))
vi.mock('cesium', async (importOriginal) => {
  const actual = await importOriginal<typeof import('cesium')>()
  return {
    ...actual,
    ScreenSpaceEventHandler: class {
      setInputAction(action: (event: { position: { x: number; y: number } }) => void, type: number) {
        const name = Object.entries(actual.ScreenSpaceEventType).find(([, value]) => value === type)![0]
        inputActions[name] = action
      }
      destroy() { handlerDestroy() }
    },
  }
})

const viewerState: { viewer: unknown } = { viewer: null }
vi.mock('utils/context/ViewerContext', () => ({ useViewer: () => viewerState }))

const featuresState: { features: { type: string }[]; activeDrawingTool: string | null } = { features: [], activeDrawingTool: null }
vi.mock('utils/context/FeaturesContext', () => ({ useFeaturesContext: () => featuresState }))

const measurementState = { isActive: false }
vi.mock('utils/context/MeasurementContext', () => ({ useMeasurementContext: () => measurementState }))

const dropPoint = vi.fn()
vi.mock('utils/context/PointDropContext', () => ({ usePointDrop: () => ({ dropPoint }) }))

const holdAt = vi.fn((_position: unknown) => 41)
const releaseHold = vi.fn()
vi.mock('services/PointValueService', () => ({
  pointValueService: { holdAt: (position: unknown) => holdAt(position), releaseHold: (token: number) => releaseHold(token) },
}))

const pickGlobePosition = vi.fn()
vi.mock('services/drawing/DrawingUtils', () => ({
  DrawingUtils: { pickGlobePosition: (...args: unknown[]) => pickGlobePosition(...args) },
}))

const sampleElevation = vi.fn()
vi.mock('services/inspector/inspectorRequests', () => ({ sampleElevation: (positions: unknown) => sampleElevation(positions) }))

const copyCoordinates = vi.fn()
vi.mock('hooks/useCopyCoordinates', () => ({ useCopyCoordinates: () => copyCoordinates }))

import { GlobePopupProvider } from 'utils/context/GlobePopupContext'
import GlobeContextMenu from './GlobeContextMenu'

const position = Cesium.Cartesian3.fromDegrees(-32.08816, -18.2145371, 0, Cesium.Ellipsoid.MOON)
const vertexMarker = { id: new Cesium.Entity({ properties: { _isVertexMarker: true } }) }

function fakeViewer() {
  return {
    canvas: document.createElement('canvas'),
    scene: { pick: vi.fn((): unknown => undefined) },
    camera: { moveStart: new Cesium.Event() },
  }
}

const viewer = () => viewerState.viewer as ReturnType<typeof fakeViewer>

function rightClick(x = 120, y = 80) {
  act(() => {
    inputActions.RIGHT_DOWN({ position: { x, y } })
    inputActions.RIGHT_CLICK({ position: { x, y } })
  })
}

const renderMenu = () => render(<GlobePopupProvider><GlobeContextMenu /></GlobePopupProvider>)

beforeEach(() => {
  Object.keys(inputActions).forEach(key => delete inputActions[key])
  viewerState.viewer = fakeViewer()
  featuresState.features = []
  featuresState.activeDrawingTool = null
  measurementState.isActive = false
  pickGlobePosition.mockReset().mockReturnValue(position)
  sampleElevation.mockReset().mockResolvedValue({ value: -1571.6, lowest: -1571.6, highest: -1571.6 })
  for (const mock of [dropPoint, holdAt, releaseHold, copyCoordinates, handlerDestroy]) mock.mockClear()
})

describe('opening', () => {
  it('opens on a right click on the ground, with the coordinate and the elevation', async () => {
    renderMenu()
    rightClick()

    expect(screen.getByRole('menu', { name: 'Actions at -18.214537, -32.088160' })).toBeInTheDocument()
    expect(screen.getByText('-18.214537, -32.088160')).toBeInTheDocument()
    expect(screen.getByText('…')).toBeInTheDocument()
    expect(await screen.findByText('-1,572 m')).toBeInTheDocument()
    expect(sampleElevation).toHaveBeenCalledWith([{ lon: expect.closeTo(-32.08816, 6), lat: expect.closeTo(-18.2145371, 6) }])
    expect(screen.getAllByRole('menuitem').map(item => item.textContent))
      .toEqual(['add_location_altCreate point', 'content_copyCopy coordinates'])
    expect(holdAt).toHaveBeenCalledWith(position)
  })

  it('leaves the elevation out without terrain', async () => {
    sampleElevation.mockResolvedValue(null)
    renderMenu()
    rightClick()
    await waitFor(() => expect(screen.queryByText(/Elevation/)).not.toBeInTheDocument())
  })

  it('leaves the elevation out when sampling fails', async () => {
    sampleElevation.mockRejectedValue(new Error('no tile'))
    renderMenu()
    rightClick()
    await waitFor(() => expect(screen.queryByText(/Elevation/)).not.toBeInTheDocument())
  })

  it('opens nothing on the sky', () => {
    pickGlobePosition.mockReturnValue(null)
    renderMenu()
    rightClick()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('leaves the right click to a drawing tool, a measurement and a line vertex', () => {
    const { rerender } = renderMenu()
    const update = (change: () => void) => {
      change()
      rerender(<GlobePopupProvider><GlobeContextMenu /></GlobePopupProvider>)
    }

    update(() => { featuresState.activeDrawingTool = 'line' })
    rightClick()
    update(() => {
      featuresState.activeDrawingTool = null
      measurementState.isActive = true
    })
    rightClick()
    update(() => {
      measurementState.isActive = false
      featuresState.features = [{ type: 'line' }]
    })
    viewer().scene.pick.mockReturnValue(vertexMarker)
    rightClick()

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('picks only when a line exists', () => {
    const { rerender } = renderMenu()
    rightClick()
    expect(viewer().scene.pick).not.toHaveBeenCalled()

    featuresState.features = [{ type: 'line' }]
    rerender(<GlobePopupProvider><GlobeContextMenu /></GlobePopupProvider>)
    rightClick()
    expect(viewer().scene.pick).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('needs a viewer', () => {
    viewerState.viewer = null
    renderMenu()
    expect(inputActions.RIGHT_CLICK).toBeUndefined()
  })

  it('stops listening when unmounted', () => {
    const { unmount } = renderMenu()
    unmount()
    expect(handlerDestroy).toHaveBeenCalled()
  })
})

describe('actions', () => {
  it('creates a point and hands the scanner hold to the drop', async () => {
    renderMenu()
    rightClick()
    await userEvent.click(screen.getByRole('menuitem', { name: /Create point/ }))

    expect(dropPoint).toHaveBeenCalledWith(position, 41)
    expect(releaseHold).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('copies the coordinate', async () => {
    renderMenu()
    rightClick()
    await userEvent.click(screen.getByRole('menuitem', { name: /Copy coordinates/ }))

    expect(copyCoordinates).toHaveBeenCalledWith(expect.closeTo(-18.2145371, 6), expect.closeTo(-32.08816, 6))
    expect(releaseHold).toHaveBeenCalledWith(41)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('focuses the first item for the keyboard', async () => {
    renderMenu()
    rightClick()
    await waitFor(() => expect(screen.getByRole('menuitem', { name: /Create point/ })).toHaveFocus())
  })
})

describe('closing', () => {
  it('closes once the camera moves', () => {
    renderMenu()
    rightClick()
    act(() => viewer().camera.moveStart.raiseEvent())
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(releaseHold).toHaveBeenCalledWith(41)
    expect(viewer().camera.moveStart.numberOfListeners).toBe(0)
  })

  it('closes on Escape', async () => {
    renderMenu()
    rightClick()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('keeps the browser menu off the menu', () => {
    renderMenu()
    rightClick()
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    fireEvent(screen.getByRole('menu'), event)
    expect(event.defaultPrevented).toBe(true)
  })
})
