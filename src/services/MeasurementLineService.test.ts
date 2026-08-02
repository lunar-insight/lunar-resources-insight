import * as Cesium from 'cesium'

const { handlerState, isSupportedState } = vi.hoisted(() => ({
  handlerState: {
    handlers: {} as Record<number, (...args: any[]) => void>,
    destroyed: false,
  },
  isSupportedState: { value: true },
}))

vi.mock('cesium', async () => {
  const actual = await vi.importActual<typeof import('cesium')>('cesium')

  class MockScreenSpaceEventHandler {
    setInputAction(callback: (...args: any[]) => void, type: number) {
      handlerState.handlers[type] = callback
    }
    destroy() {
      handlerState.destroyed = true
      handlerState.handlers = {}
    }
  }

  const MockGroundPolylinePrimitive: any = vi.fn().mockImplementation(function (this: any, options: any) {
    this.options = options
  })
  MockGroundPolylinePrimitive.isSupported = () => isSupportedState.value

  // Real Material.fromType does browser feature detection (e.g. ImageBitmap)
  // that jsdom doesn't implement; the service only needs a stand-in object
  // it can pass through as a Polyline's `material` option.
  const MockMaterial = {
    ColorType: actual.Material.ColorType,
    fromType: vi.fn(() => ({})),
  }

  return {
    ...actual,
    ScreenSpaceEventHandler: MockScreenSpaceEventHandler,
    GroundPolylinePrimitive: MockGroundPolylinePrimitive,
    Material: MockMaterial,
  }
})

const { MeasurementLineService } = await import('./MeasurementLineService')

const LEFT_CLICK = Cesium.ScreenSpaceEventType.LEFT_CLICK
const MOUSE_MOVE = Cesium.ScreenSpaceEventType.MOUSE_MOVE
const RIGHT_CLICK = Cesium.ScreenSpaceEventType.RIGHT_CLICK

const pointA = Cesium.Cartesian3.fromDegrees(10, 20, 0)
const pointB = Cesium.Cartesian3.fromDegrees(11, 21, 0)
const pointC = Cesium.Cartesian3.fromDegrees(12, 22, 0)

const makeViewer = () => ({
  canvas: { style: { cursor: 'default' } },
  scene: {
    pickPosition: vi.fn(() => undefined),
    globe: { ellipsoid: Cesium.Ellipsoid.MOON },
    primitives: { add: vi.fn(), remove: vi.fn() },
    groundPrimitives: { add: vi.fn(), remove: vi.fn() },
  },
  camera: {
    pickEllipsoid: vi.fn(() => undefined),
  },
}) as unknown as Cesium.Viewer

const click = (position: Cesium.Cartesian2 = new Cesium.Cartesian2(0, 0)) => {
  handlerState.handlers[LEFT_CLICK]?.({ position })
}
const moveTo = (position: Cesium.Cartesian2 = new Cesium.Cartesian2(0, 0)) => {
  handlerState.handlers[MOUSE_MOVE]?.({ endPosition: position })
}
const rightClick = () => {
  handlerState.handlers[RIGHT_CLICK]?.()
}

beforeEach(() => {
  handlerState.handlers = {}
  handlerState.destroyed = false
  isSupportedState.value = true
})

describe('start/stop lifecycle', () => {
  it('registers click, move, and right-click handlers and sets a crosshair cursor', () => {
    const viewer = makeViewer()
    const service = new MeasurementLineService()
    service.setViewer(viewer)

    service.start()

    expect(handlerState.handlers[LEFT_CLICK]).toBeDefined()
    expect(handlerState.handlers[MOUSE_MOVE]).toBeDefined()
    expect(handlerState.handlers[RIGHT_CLICK]).toBeDefined()
    expect(viewer.canvas.style.cursor).toBe('crosshair')
  })

  it('does nothing if called without a viewer', () => {
    const service = new MeasurementLineService()
    expect(() => service.start()).not.toThrow()
    expect(handlerState.handlers[LEFT_CLICK]).toBeUndefined()
  })

  it('is idempotent: calling start twice does not re-create the handler', () => {
    const viewer = makeViewer()
    const service = new MeasurementLineService()
    service.setViewer(viewer)

    service.start()
    const firstClickHandler = handlerState.handlers[LEFT_CLICK]
    handlerState.handlers = {}
    service.start()

    expect(handlerState.handlers[LEFT_CLICK]).toBeUndefined()
    expect(firstClickHandler).toBeDefined()
  })

  it('restores the previous cursor and clears state on stop', () => {
    const viewer = makeViewer()
    viewer.canvas.style.cursor = 'grab'
    const service = new MeasurementLineService()
    service.setViewer(viewer)
    const onPointsCommitted = vi.fn()
    service.setCallbacks(onPointsCommitted, vi.fn(), vi.fn())

    service.start()
    viewer.scene.pickPosition = vi.fn(() => pointA)
    click()
    onPointsCommitted.mockClear()

    service.stop()

    expect(handlerState.destroyed).toBe(true)
    expect(viewer.canvas.style.cursor).toBe('grab')

    // Placing a new point after stop (without calling start again) should
    // not be possible: the handler was torn down.
    click()
    expect(onPointsCommitted).not.toHaveBeenCalled()
  })

  it('is safe to call stop without ever starting', () => {
    const service = new MeasurementLineService()
    expect(() => service.stop()).not.toThrow()
  })
})

describe('placement', () => {
  it('commits the first point on a successful pick', () => {
    const viewer = makeViewer()
    viewer.scene.pickPosition = vi.fn(() => pointA)
    const service = new MeasurementLineService()
    service.setViewer(viewer)
    const onPointsCommitted = vi.fn()
    service.setCallbacks(onPointsCommitted, vi.fn(), vi.fn())
    service.start()

    click()

    expect(onPointsCommitted).toHaveBeenCalledTimes(1)
    const [committed] = onPointsCommitted.mock.calls[0]
    expect(committed).toHaveLength(1)
    const expected = Cesium.Ellipsoid.MOON.cartesianToCartographic(pointA)
    expect(committed[0].longitude).toBeCloseTo(expected.longitude)
    expect(committed[0].latitude).toBeCloseTo(expected.latitude)
  })

  it('does not commit when picking fails', () => {
    const viewer = makeViewer()
    const service = new MeasurementLineService()
    service.setViewer(viewer)
    const onPointsCommitted = vi.fn()
    service.setCallbacks(onPointsCommitted, vi.fn(), vi.fn())
    service.start()

    click()

    expect(onPointsCommitted).not.toHaveBeenCalled()
  })

  it('ignores a second click at the exact same position as the first', () => {
    const viewer = makeViewer()
    viewer.scene.pickPosition = vi.fn(() => pointA)
    const service = new MeasurementLineService()
    service.setViewer(viewer)
    const onPointsCommitted = vi.fn()
    service.setCallbacks(onPointsCommitted, vi.fn(), vi.fn())
    service.start()

    click()
    click()

    expect(onPointsCommitted).toHaveBeenCalledTimes(1)
  })

  it('reports the live hover position while placing, and clears it once both points are committed', () => {
    const viewer = makeViewer()
    viewer.scene.pickPosition = vi.fn(() => pointA)
    const service = new MeasurementLineService()
    service.setViewer(viewer)
    const onHoverPosition = vi.fn()
    service.setCallbacks(vi.fn(), vi.fn(), onHoverPosition)
    service.start()

    moveTo()
    expect(onHoverPosition).toHaveBeenLastCalledWith(pointA)

    click()
    viewer.scene.pickPosition = vi.fn(() => pointB)
    moveTo()
    expect(onHoverPosition).toHaveBeenLastCalledWith(pointB)

    click()
    onHoverPosition.mockClear()
    moveTo()
    expect(onHoverPosition).toHaveBeenCalledWith(null)
  })

  it('commits the second point and builds the settled line', () => {
    const viewer = makeViewer()
    const service = new MeasurementLineService()
    service.setViewer(viewer)
    const onPointsCommitted = vi.fn()
    service.setCallbacks(onPointsCommitted, vi.fn(), vi.fn())
    service.start()

    viewer.scene.pickPosition = vi.fn(() => pointA)
    click()
    viewer.scene.pickPosition = vi.fn(() => pointB)
    click()

    expect(onPointsCommitted).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.anything(), expect.anything()])
    )
    const [committed] = onPointsCommitted.mock.calls[onPointsCommitted.mock.calls.length - 1]
    expect(committed).toHaveLength(2)

    // Default mode is 'surface': a floating (non-ground) line is used.
    expect(viewer.scene.primitives.add).toHaveBeenCalled()
    expect(viewer.scene.groundPrimitives.add).not.toHaveBeenCalled()
  })

  it('starts a fresh measurement when clicking after two points are already placed', () => {
    const viewer = makeViewer()
    const service = new MeasurementLineService()
    service.setViewer(viewer)
    const onPointsCommitted = vi.fn()
    service.setCallbacks(onPointsCommitted, vi.fn(), vi.fn())
    service.start()

    viewer.scene.pickPosition = vi.fn(() => pointA)
    click()
    viewer.scene.pickPosition = vi.fn(() => pointB)
    click()

    viewer.scene.pickPosition = vi.fn(() => pointC)
    click()

    const [committed] = onPointsCommitted.mock.calls[onPointsCommitted.mock.calls.length - 1]
    expect(committed).toHaveLength(1)
    const expected = Cesium.Ellipsoid.MOON.cartesianToCartographic(pointC)
    expect(committed[0].longitude).toBeCloseTo(expected.longitude)
  })
})

describe('cancel (Escape / right-click)', () => {
  it('clears an in-progress placement on right-click', () => {
    const viewer = makeViewer()
    viewer.scene.pickPosition = vi.fn(() => pointA)
    const service = new MeasurementLineService()
    service.setViewer(viewer)
    const onPointsCommitted = vi.fn()
    service.setCallbacks(onPointsCommitted, vi.fn(), vi.fn())
    service.start()

    click()
    rightClick()

    const [committed] = onPointsCommitted.mock.calls[onPointsCommitted.mock.calls.length - 1]
    expect(committed).toHaveLength(0)
  })

  it('clears a completed measurement on Escape', () => {
    const viewer = makeViewer()
    const service = new MeasurementLineService()
    service.setViewer(viewer)
    const onPointsCommitted = vi.fn()
    service.setCallbacks(onPointsCommitted, vi.fn(), vi.fn())
    service.start()

    viewer.scene.pickPosition = vi.fn(() => pointA)
    click()
    viewer.scene.pickPosition = vi.fn(() => pointB)
    click()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    const [committed] = onPointsCommitted.mock.calls[onPointsCommitted.mock.calls.length - 1]
    expect(committed).toHaveLength(0)
    expect(viewer.scene.groundPrimitives.remove).not.toHaveBeenCalled()
  })
})

describe('distance mode', () => {
  const placeTwoPoints = (service: InstanceType<typeof MeasurementLineService>, viewer: Cesium.Viewer) => {
    viewer.scene.pickPosition = vi.fn(() => pointA)
    click()
    viewer.scene.pickPosition = vi.fn(() => pointB)
    click()
  }

  it('defaults to a floating (surface) line', () => {
    const viewer = makeViewer()
    const service = new MeasurementLineService()
    service.setViewer(viewer)
    service.setCallbacks(vi.fn(), vi.fn(), vi.fn())
    service.start()

    placeTwoPoints(service, viewer)

    expect(viewer.scene.primitives.add).toHaveBeenCalledTimes(1)
    expect(viewer.scene.groundPrimitives.add).not.toHaveBeenCalled()
  })

  it('switches to a terrain-draped ground primitive when supported', () => {
    const viewer = makeViewer()
    const service = new MeasurementLineService()
    service.setViewer(viewer)
    service.setCallbacks(vi.fn(), vi.fn(), vi.fn())
    service.start()
    placeTwoPoints(service, viewer)

    service.setDistanceMode('terrain')

    expect(viewer.scene.primitives.remove).toHaveBeenCalled()
    expect(viewer.scene.groundPrimitives.add).toHaveBeenCalledTimes(1)
  })

  it('falls back to a floating line when GroundPolylinePrimitive is unsupported', () => {
    isSupportedState.value = false
    const viewer = makeViewer()
    const service = new MeasurementLineService()
    service.setViewer(viewer)
    service.setCallbacks(vi.fn(), vi.fn(), vi.fn())
    service.start()
    placeTwoPoints(service, viewer)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    service.setDistanceMode('terrain')

    expect(viewer.scene.groundPrimitives.add).not.toHaveBeenCalled()
    expect(viewer.scene.primitives.add).toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('does nothing when set to the mode that is already active', () => {
    const viewer = makeViewer()
    const service = new MeasurementLineService()
    service.setViewer(viewer)
    service.setCallbacks(vi.fn(), vi.fn(), vi.fn())
    service.start()
    placeTwoPoints(service, viewer)
    ;(viewer.scene.primitives.add as ReturnType<typeof vi.fn>).mockClear()

    service.setDistanceMode('surface')

    expect(viewer.scene.primitives.add).not.toHaveBeenCalled()
  })

  it('switching back from terrain to surface removes the ground primitive and rebuilds the floating line', () => {
    const viewer = makeViewer()
    const service = new MeasurementLineService()
    service.setViewer(viewer)
    service.setCallbacks(vi.fn(), vi.fn(), vi.fn())
    service.start()
    placeTwoPoints(service, viewer)
    service.setDistanceMode('terrain')

    service.setDistanceMode('surface')

    expect(viewer.scene.groundPrimitives.remove).toHaveBeenCalled()
    expect(viewer.scene.primitives.add).toHaveBeenCalled()
  })

  it('has no rendering effect when set before any points are placed', () => {
    const viewer = makeViewer()
    const service = new MeasurementLineService()
    service.setViewer(viewer)
    service.setCallbacks(vi.fn(), vi.fn(), vi.fn())

    service.setDistanceMode('terrain')

    expect(viewer.scene.groundPrimitives.add).not.toHaveBeenCalled()
    expect(viewer.scene.primitives.add).not.toHaveBeenCalled()
  })
})

describe('dragging an endpoint', () => {
  const placeTwoPoints = (viewer: Cesium.Viewer) => {
    viewer.scene.pickPosition = vi.fn(() => pointA)
    click()
    viewer.scene.pickPosition = vi.fn(() => pointB)
    click()
  }

  it('previewDrag is a no-op before both points exist', () => {
    const viewer = makeViewer()
    const service = new MeasurementLineService()
    service.setViewer(viewer)
    const onLiveDistance = vi.fn()
    service.setCallbacks(vi.fn(), onLiveDistance, vi.fn())
    service.start()

    viewer.scene.pickPosition = vi.fn(() => pointA)
    click()
    service.previewDrag(1, pointB)

    expect(onLiveDistance).not.toHaveBeenCalled()
  })

  it('previewDrag reuses the existing floating line and reports a live distance', () => {
    const viewer = makeViewer()
    const service = new MeasurementLineService()
    service.setViewer(viewer)
    const onLiveDistance = vi.fn()
    service.setCallbacks(vi.fn(), onLiveDistance, vi.fn())
    service.start()
    placeTwoPoints(viewer)

    const draggedPosition = Cesium.Cartesian3.fromDegrees(11.5, 21.5, 0)
    service.previewDrag(1, draggedPosition)

    // The floating PolylineCollection created during placement is reused
    // (its positions updated in place), not re-added to the scene.
    expect(viewer.scene.primitives.add).toHaveBeenCalledTimes(1)
    expect(onLiveDistance).toHaveBeenCalledTimes(1)
    const [meters] = onLiveDistance.mock.calls[0]
    const expected = new Cesium.EllipsoidGeodesic(
      Cesium.Ellipsoid.MOON.cartesianToCartographic(pointA),
      Cesium.Ellipsoid.MOON.cartesianToCartographic(draggedPosition)
    ).surfaceDistance
    expect(meters).toBeCloseTo(expected)
  })

  it('previewDrag removes an existing ground primitive for live feedback', () => {
    const viewer = makeViewer()
    const service = new MeasurementLineService()
    service.setViewer(viewer)
    service.setCallbacks(vi.fn(), vi.fn(), vi.fn())
    service.start()
    placeTwoPoints(viewer)
    service.setDistanceMode('terrain')
    ;(viewer.scene.groundPrimitives.remove as ReturnType<typeof vi.fn>).mockClear()

    service.previewDrag(0, Cesium.Cartesian3.fromDegrees(9.5, 19.5, 0))

    expect(viewer.scene.groundPrimitives.remove).toHaveBeenCalledTimes(1)
  })

  it('commitDrag updates the committed point and reports the new pair', () => {
    const viewer = makeViewer()
    const service = new MeasurementLineService()
    service.setViewer(viewer)
    const onPointsCommitted = vi.fn()
    service.setCallbacks(onPointsCommitted, vi.fn(), vi.fn())
    service.start()
    placeTwoPoints(viewer)
    onPointsCommitted.mockClear()

    const finalPosition = Cesium.Cartesian3.fromDegrees(11.2, 21.2, 5)
    service.commitDrag(1, finalPosition)

    expect(onPointsCommitted).toHaveBeenCalledTimes(1)
    const [committed] = onPointsCommitted.mock.calls[0]
    expect(committed).toHaveLength(2)
    const expected = Cesium.Ellipsoid.MOON.cartesianToCartographic(finalPosition)
    expect(committed[1].longitude).toBeCloseTo(expected.longitude)
    expect(committed[1].height).toBeCloseTo(expected.height)
  })

  it('commitDrag is a no-op before both points exist', () => {
    const viewer = makeViewer()
    const service = new MeasurementLineService()
    service.setViewer(viewer)
    const onPointsCommitted = vi.fn()
    service.setCallbacks(onPointsCommitted, vi.fn(), vi.fn())
    service.start()

    viewer.scene.pickPosition = vi.fn(() => pointA)
    click()
    onPointsCommitted.mockClear()

    service.commitDrag(0, pointB)

    expect(onPointsCommitted).not.toHaveBeenCalled()
  })
})

describe('destroy', () => {
  it('tears down the handler and stops invoking callbacks', () => {
    const viewer = makeViewer()
    const service = new MeasurementLineService()
    service.setViewer(viewer)
    const onPointsCommitted = vi.fn()
    service.setCallbacks(onPointsCommitted, vi.fn(), vi.fn())
    service.start()

    service.destroy()

    expect(handlerState.destroyed).toBe(true)

    // Restarting after destroy still works mechanically, but the old
    // callback references were cleared and are never invoked again.
    service.start()
    viewer.scene.pickPosition = vi.fn(() => pointA)
    click()
    expect(onPointsCommitted).not.toHaveBeenCalled()
  })
})
