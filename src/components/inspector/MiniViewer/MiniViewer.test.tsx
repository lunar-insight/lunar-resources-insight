import { useState } from 'react'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as Cesium from 'cesium'

const inspector = vi.hoisted(() => ({
  pictureColor: 'gray' as 'gray' | 'viridis',
  setPictureColor: vi.fn(),
  store: { pictures: null as unknown },
}))
const layers = vi.hoisted(() => ({ getMapDisplay: vi.fn() }))
const tables = vi.hoisted(() => ({ byName: {} as Record<string, Uint8Array | undefined> }))

vi.mock('utils/context/InspectorContext', () => ({ useInspectorContext: () => inspector }))
vi.mock('utils/context/LayerContext', () => ({ useLayerContext: () => layers }))
vi.mock('services/ColormapService', () => ({
  colormapService: { getColormapTable: (name: string) => tables.byName[name] },
}))

import type { Feature } from 'components/navigation/FeaturesSection/types'
import type { InspectorLine, LineFile } from 'services/inspector/inspectorLayers'
import { PICTURE_HEIGHT, PICTURE_WIDTH, pointView, shapeView } from 'services/inspector/pictureGeometry'
import { pictureKey, type PictureEntry, type PictureKind } from 'services/inspector/PictureStore'
import { shapeRing } from 'services/inspector/featureGeometry'
import { MiniViewer, type PictureHighlight, type PictureLimit } from './MiniViewer'
import { tableGradient } from './ColorButton'
import { InfoRow } from './InfoRow'
import { maskToCanvas, pixelsToCanvas, resolveCssColor } from './pictureCanvas'
import { usePicture } from './usePicture'

const deg = (lon: number, lat: number) => Cesium.Cartographic.fromDegrees(lon, lat)

const point: Feature = {
  id: 'p', type: 'point', name: 'Point 1', entity: {} as Cesium.Entity, color: '#4fc3e8',
  metadata: { createdAt: new Date(0), position: deg(30, 10) }, inspectorOpen: true, visible: true,
}
const polygon: Feature = {
  ...point, id: 's', type: 'polygon', name: 'Polygon 1',
  metadata: { createdAt: new Date(0), positions: [deg(10, 10), deg(11, 10), deg(11, 11), deg(10, 11)] },
}
const file: LineFile = { layerId: 'feo', filename: 'feo.tif' }
const line = {
  category: 'compound', cardName: 'Iron oxide', datasetLabel: 'Kaguya MI', decimals: 2, unit: 'wt%',
} as InspectorLine

const COUNT = PICTURE_WIDTH * PICTURE_HEIGHT
const pointPicture = {
  gray: new Uint8Array(COUNT).fill(100),
  alpha: new Uint8Array(COUNT).fill(255),
  range: [0, 24] as [number, number],
  view: pointView({ lon: 30, lat: 10 }, 1),
}
const shapePicture = { ...pointPicture, view: shapeView(shapeRing(polygon)!, { lon: 10.5, lat: 10.5 }, 1) }

/** A picture store answering from a fixed map. */
function fakePictures() {
  const entries = new Map<string, PictureEntry>()
  const listeners = new Set<() => void>()
  let version = 0
  const notify = () => { version++; listeners.forEach(listener => listener()) }
  return {
    entries,
    set(feature: Feature, kind: PictureKind, entry: PictureEntry | undefined) {
      const key = pictureKey(feature, file, kind)
      if (entry) entries.set(key, entry)
      else entries.delete(key)
      act(notify)
    },
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    getVersion: () => version,
    get: (key: string) => entries.get(key),
    request: vi.fn(),
    retry: vi.fn(),
  }
}

let pictures: ReturnType<typeof fakePictures>
let contexts: Record<string, ReturnType<typeof vi.fn>>[]

function fakeContext() {
  const context = {
    setTransform: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), moveTo: vi.fn(),
    lineTo: vi.fn(), closePath: vi.fn(), fill: vi.fn(), stroke: vi.fn(), arc: vi.fn(), fillRect: vi.fn(), putImageData: vi.fn(),
    createImageData: vi.fn((width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) })),
  }
  contexts.push(context)
  return context
}

beforeEach(() => {
  contexts = []
  pictures = fakePictures()
  inspector.store.pictures = pictures
  inspector.pictureColor = 'gray'
  inspector.setPictureColor.mockClear()
  layers.getMapDisplay.mockReturnValue(undefined)
  const viridis = new Uint8Array(1024).fill(9)
  tables.byName = { viridis, magma: new Uint8Array(1024).fill(7) }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => fakeContext()) as unknown as typeof HTMLCanvasElement.prototype.getContext)
})

afterEach(() => {
  vi.restoreAllMocks()
})

const ready = (picture = pointPicture): PictureEntry => ({ status: 'ready', picture })

function renderReady(feature = point, props: { highlight?: PictureHighlight | null; limit?: PictureLimit } = {}) {
  pictures.entries.set(pictureKey(feature, file, 'data'), ready(feature === point ? pointPicture : shapePicture))
  return render(<MiniViewer feature={feature} line={line} file={file} {...props} />)
}

const canvas = () => screen.queryByRole('img')
const figure = () => document.querySelector('figure')!
const rows = () => [...figure().children] as HTMLElement[]
const colorButton = () => screen.queryByRole('button', { name: /^Colors:/ })
const terrainButton = () => screen.queryByRole('button', { name: 'Terrain' })
const putPixels = () => contexts.flatMap(context => context.putImageData.mock.calls.map(call => call[0].data as Uint8ClampedArray))

describe('states', () => {
  it('requests the picture on mount and shows it loading, with nothing else but its rows', () => {
    render(<MiniViewer feature={point} line={line} file={file} />)
    expect(pictures.request).toHaveBeenCalledTimes(1)
    expect(pictures.request).toHaveBeenCalledWith(point, file, 'data')
    expect(figure()).toHaveTextContent('Loading the picture')
    expect(canvas()).toBeNull()
    expect(colorButton()).toBeNull()
    expect(terrainButton()).toBeNull()
    expect(rows()).toHaveLength(3)
    expect(rows()[1]).toBeEmptyDOMElement()
    expect(rows()[2]).toBeEmptyDOMElement()
  })

  it('states the wait while the camera moves', () => {
    pictures.entries.set(pictureKey(point, file, 'data'), { status: 'waiting' })
    render(<MiniViewer feature={point} line={line} file={file} />)
    expect(figure()).toHaveTextContent('Waiting for the map to stop moving')
    expect(pictures.request).not.toHaveBeenCalled()
  })

  it('states a failure and retries', async () => {
    pictures.entries.set(pictureKey(point, file, 'data'), { status: 'failed' })
    render(<MiniViewer feature={point} line={line} file={file} />)
    expect(figure()).toHaveTextContent('The picture could not be loaded.')
    expect(rows()).toHaveLength(3)
    expect(colorButton()).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(pictures.retry).toHaveBeenCalledWith(pictureKey(point, file, 'data'))
  })

  it('shows the picture with its ramp, scale and corner buttons when ready', () => {
    renderReady()
    expect(canvas()).toHaveAttribute('aria-label', 'Map of Iron oxide · Kaguya MI around Point 1')
    expect(canvas()).toHaveAttribute('width', '422')
    expect(canvas()).toHaveAttribute('height', '300')
    expect(colorButton()).toBeInTheDocument()
    expect(terrainButton()).toBeInTheDocument()
    expect(figure()).toHaveTextContent('5 km')
    expect(rows()[1]).toHaveTextContent('024 wt%')
  })

  it('asks again when the entry is removed by a cancel', () => {
    renderReady()
    expect(pictures.request).not.toHaveBeenCalled()
    pictures.set(point, 'data', undefined)
    expect(pictures.request).toHaveBeenCalledWith(point, file, 'data')
  })

  it('asks again when the feature moves', () => {
    const { rerender } = renderReady()
    const moved = { ...point, metadata: { ...point.metadata, position: deg(31, 10) } }
    rerender(<MiniViewer feature={moved} line={line} file={file} />)
    expect(pictures.request).toHaveBeenCalledWith(moved, file, 'data')
  })
})

describe('colors', () => {
  it('draws gray without a request, and cycles gray then viridis', async () => {
    renderReady()
    expect(colorButton()).toHaveAttribute('aria-label', 'Colors: gray. Press for viridis')
    await userEvent.click(colorButton()!)
    expect(inspector.setPictureColor).toHaveBeenCalledWith('viridis')
    expect(pictures.request).toHaveBeenCalledTimes(0)
  })

  it('draws viridis from the session, then returns to gray', async () => {
    inspector.pictureColor = 'viridis'
    renderReady()
    expect(colorButton()).toHaveAttribute('aria-label', 'Colors: viridis. Press for gray')
    expect([...putPixels()[0].slice(0, 4)]).toEqual([9, 9, 9, 9])
    await userEvent.click(colorButton()!)
    expect(inspector.setPictureColor).toHaveBeenCalledWith('gray')
  })

  it('stays on gray when viridis is unavailable', async () => {
    tables.byName.viridis = undefined
    inspector.pictureColor = 'viridis'
    renderReady()
    expect(colorButton()).toHaveAttribute('aria-label', 'Colors: gray')
    expect(putPixels()[0][0]).toBe(100)
    await userEvent.click(colorButton()!)
    expect(inspector.setPictureColor).toHaveBeenCalledWith('gray')
  })

  it.each([
    ['gray at the whole range', { colormap: 'gray', rescale: [0, 24], filter: null }],
    ['viridis at the whole range', { colormap: 'viridis', rescale: [0, 24], filter: null }],
  ])('offers no third state for %s', (_name, display) => {
    layers.getMapDisplay.mockReturnValue(display)
    renderReady()
    expect(colorButton()).toHaveAttribute('aria-label', 'Colors: gray. Press for viridis')
  })

  it.each([
    ['another colormap', { colormap: 'magma', rescale: [0, 24], filter: null }],
    ['another low end', { colormap: 'gray', rescale: [5, 24], filter: null }],
    ['another high end', { colormap: 'gray', rescale: [0, 15], filter: null }],
    ['a filter', { colormap: 'viridis', rescale: [0, 24], filter: [0, 24] }],
  ])('offers the map colors for %s', async (_name, display) => {
    inspector.pictureColor = 'viridis'
    layers.getMapDisplay.mockReturnValue(display)
    renderReady()
    expect(colorButton()).toHaveAttribute('aria-label', 'Colors: viridis. Press for the colors of the map')
    await userEvent.click(colorButton()!)
    expect(colorButton()).toHaveAttribute('aria-label', 'Colors: the colors of the map. Press for gray')
    expect(rows()[1]).toHaveTextContent('as on the map')
  })

  it('offers no third state when the table of the map colors did not load', () => {
    layers.getMapDisplay.mockReturnValue({ colormap: 'plasma', rescale: [0, 24], filter: null })
    renderReady()
    expect(colorButton()).toHaveAttribute('aria-label', 'Colors: gray. Press for viridis')
  })

  it('colors from the map range and filter, states it on the ramp, and sends no request', async () => {
    inspector.pictureColor = 'viridis'
    layers.getMapDisplay.mockReturnValue({ colormap: 'magma', rescale: [5, 15], filter: [5, 15] })
    renderReady()
    await userEvent.click(colorButton()!)

    expect(rows()[1]).toHaveTextContent('515 wt%, as on the map')
    // Gray 100 reads 9.46 wt%, inside the filter
    expect(putPixels().at(-1)![3]).toBe(7)
    expect(pictures.request).not.toHaveBeenCalled()
  })

  it('falls back to gray when the layer leaves the map', async () => {
    inspector.pictureColor = 'viridis'
    layers.getMapDisplay.mockReturnValue({ colormap: 'magma', rescale: [5, 15], filter: null })
    const { rerender } = renderReady()
    await userEvent.click(colorButton()!)
    expect(rows()[1]).toHaveTextContent('as on the map')

    inspector.setPictureColor.mockClear()
    layers.getMapDisplay.mockReturnValue(undefined)
    rerender(<MiniViewer feature={point} line={line} file={file} />)
    expect(inspector.setPictureColor).toHaveBeenCalledWith('gray')
    expect(rows()[1]).not.toHaveTextContent('as on the map')
  })

  it('leaves out a unit on the ramp when the line has none', () => {
    pictures.entries.set(pictureKey(point, file, 'data'), ready())
    render(<MiniViewer feature={point} line={{ ...line, unit: undefined }} file={file} />)
    expect(rows()[1].textContent).toBe('024')
  })
})

describe('terrain', () => {
  it('requests only on the first press, and hides the color button over it', async () => {
    renderReady()
    expect(pictures.request).not.toHaveBeenCalled()
    await userEvent.click(terrainButton()!)
    expect(pictures.request).toHaveBeenCalledWith(point, file, 'terrain')
    expect(colorButton()).toBeNull()
    expect(terrainButton()).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows the terrain state, with the button back available', async () => {
    renderReady()
    await userEvent.click(terrainButton()!)
    expect(figure()).toHaveTextContent('Loading the picture')
    expect(canvas()).toBeNull()
    pictures.set(point, 'terrain', { status: 'failed' })
    expect(figure()).toHaveTextContent('The picture could not be loaded.')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(pictures.retry).toHaveBeenCalledWith(pictureKey(point, file, 'terrain'))

    await userEvent.click(terrainButton()!)
    expect(canvas()).toBeInTheDocument()
    expect(colorButton()).toBeInTheDocument()
  })

  it('draws the terrain in gray, with its source on the ramp row', async () => {
    inspector.pictureColor = 'viridis'
    renderReady()
    await userEvent.click(terrainButton()!)
    const gray = new Uint8Array(COUNT).fill(50)
    pictures.set(point, 'terrain', ready({ ...pointPicture, gray, range: [0, 255] }))
    expect(canvas()).toBeInTheDocument()
    expect(rows()[1]).toHaveTextContent('Terrain: LROC WAC, 100 m per pixel')
    expect(putPixels().at(-1)![0]).toBe(50)
  })

  it('still reads values from the file over the terrain', async () => {
    renderReady()
    await userEvent.click(terrainButton()!)
    pictures.set(point, 'terrain', ready({ ...pointPicture, range: [0, 255], gray: new Uint8Array(COUNT).fill(50) }))
    fireEvent.pointerMove(canvas()!, { clientX: 100, clientY: 70 })
    expect(rows()[2]).toHaveTextContent('9.5 wt%')
  })
})

describe('info row', () => {
  const info = () => rows()[2]

  it('gives a point its box', () => {
    renderReady()
    expect(info()).toHaveTextContent(/^64\.0 × 45\.5 km$/)
  })

  it('invites a shape to read a value', () => {
    renderReady(polygon)
    expect(info()).toHaveTextContent('Point at the picture to read a value')
  })

  it('reads the value and the place under the pointer, and returns on leaving', () => {
    renderReady()
    fireEvent.pointerMove(canvas()!, { clientX: 105.5, clientY: 75 })
    expect(info()).toHaveTextContent('9.5 wt% · 10.000°N, 30.000°E')
    expect(info().querySelector('b')).toHaveTextContent('9.5 wt%')
    fireEvent.pointerLeave(canvas()!)
    expect(info()).toHaveTextContent(/^64\.0 × 45\.5 km$/)
  })

  it('reads No data on a transparent pixel', () => {
    const alpha = new Uint8Array(COUNT).fill(0)
    pictures.entries.set(pictureKey(point, file, 'data'), ready({ ...pointPicture, alpha }))
    render(<MiniViewer feature={point} line={line} file={file} />)
    fireEvent.pointerMove(canvas()!, { clientX: 105.5, clientY: 75 })
    expect(info()).toHaveTextContent(/^No data · /)
  })

  it('reads a value without a unit, and stays in the picture past its edge', () => {
    pictures.entries.set(pictureKey(point, file, 'data'), ready())
    render(<MiniViewer feature={point} line={{ ...line, unit: undefined }} file={file} />)
    fireEvent.pointerMove(canvas()!, { clientX: 5000, clientY: -5 })
    expect(info().querySelector('b')).toHaveTextContent(/^9\.5$/)
  })

  it('states the values lit, ahead of the point hint, with the category swatch', () => {
    renderReady(polygon, { highlight: { range: [0, 24], text: '0.0 to 24.0 wt%: 100% of the shape' } })
    expect(info()).toHaveTextContent('0.0 to 24.0 wt%: 100% of the shape')
    expect(info().querySelector('i')).toHaveStyle({ background: 'var(--category-compound)' })
  })

  it('takes the pointer over the values lit', () => {
    renderReady(polygon, { highlight: { range: [0, 24], text: 'Lit' } })
    fireEvent.pointerMove(canvas()!, { clientX: 100, clientY: 70 })
    expect(info()).toHaveTextContent(/^9\.5 wt%/)
  })

  it('states the share at the limit and the box, with the limit swatch', () => {
    const gray = new Uint8Array(COUNT).fill(100)
    gray.fill(255, 0, COUNT / 4)
    pictures.entries.set(pictureKey(point, file, 'data'), ready({ ...pointPicture, gray }))
    render(<MiniViewer feature={point} line={line} file={file} limit={{ value: 24 }} />)
    expect(info()).toHaveTextContent('25% at the limit, 64.0 × 45.5 km')
    expect(info().querySelector('i')).toHaveStyle({ background: 'var(--data-coverage)' })
  })
})

describe('drawing', () => {
  const drawn = () => contexts.find(context => context.setTransform.mock.calls.length > 0)!

  it('marks a point at the center of its box', () => {
    renderReady()
    expect(drawn().arc.mock.calls[0][0]).toBeCloseTo(105.5, 6)
    expect(drawn().arc.mock.calls[0][1]).toBeCloseTo(75, 6)
    expect(drawn().fill).not.toHaveBeenCalled()
  })

  it('dims outside a shape and strokes its outline', () => {
    renderReady(polygon)
    expect(drawn().fill).toHaveBeenCalledWith('evenodd')
    expect(drawn().arc).not.toHaveBeenCalled()
    expect(drawn().lineTo).toHaveBeenCalledTimes(6)
  })

  it('tints the pixels lit and shades the rest of the shape, drawn over the picture', () => {
    renderReady(polygon, { highlight: { range: [9, 10], text: 'Lit' } })
    expect(drawn().drawImage).toHaveBeenCalledTimes(3)
  })

  it('shades the shape when no pixel falls in the values lit', () => {
    renderReady(polygon, { highlight: { range: [20, 21], text: 'Lit' } })
    const shade = putPixels().find(rgba => rgba.some((value, i) => i % 4 === 3 && value === Math.round(0.59 * 255)))
    expect(shade).toBeDefined()
  })

  it('tints the pixels at the limit', () => {
    const { rerender } = renderReady(point, { limit: { value: 24, longitudes: [-180, 180] } })
    expect(drawn().drawImage).toHaveBeenCalledTimes(2)
    rerender(<MiniViewer feature={point} line={line} file={file} />)
    const lastDraw = contexts.filter(context => context.setTransform.mock.calls.length > 0).at(-1)!
    expect(lastDraw.drawImage).toHaveBeenCalledTimes(1)
  })

  it('draws no tint on a point with no highlight', () => {
    renderReady(point, { highlight: { range: [0, 24], text: 'Not for points' } })
    expect(drawn().drawImage).toHaveBeenCalledTimes(1)
    expect(rows()[2]).toHaveTextContent(/km$/)
  })
})

describe('pictureCanvas', () => {
  it('puts a picture on a canvas of its size', () => {
    const rgba = new Uint8ClampedArray(COUNT * 4).fill(3)
    const canvas = pixelsToCanvas(rgba)
    expect([canvas.width, canvas.height]).toEqual([422, 300])
    expect(putPixels()[0]).toEqual(rgba)
  })

  it('paints a mask in a color at an opacity, only where it is set', () => {
    const mask = new Uint8Array(COUNT)
    mask[1] = 1
    maskToCanvas(mask, 'rgb(1, 2, 3)', 0.5)
    const [alpha] = putPixels()
    expect(alpha[3]).toBe(0)
    expect(alpha[7]).toBe(128)
    const context = contexts[0] as unknown as Record<string, unknown>
    expect(context.globalCompositeOperation).toBe('source-in')
    expect(context.fillStyle).toBe('rgb(1, 2, 3)')
    expect(contexts[0].fillRect).toHaveBeenCalledWith(0, 0, 422, 300)
  })

  it('resolves a variable on the element, and passes other colors on', () => {
    const element = document.createElement('div')
    element.style.setProperty('--test-color', ' rgb(1, 2, 3) ')
    document.body.append(element)
    expect(resolveCssColor(element, 'var(--test-color)')).toBe('rgb(1, 2, 3)')
    expect(resolveCssColor(element, '#fff')).toBe('#fff')
    element.remove()
  })
})

describe('tableGradient', () => {
  it('runs through the table to its last entry', () => {
    const table = new Uint8Array(1024)
    table.set([1, 2, 3, 255], 0)
    table.set([4, 5, 6, 255], 255 * 4)
    const gradient = tableGradient(table, 'to top')
    expect(gradient.startsWith('linear-gradient(to top, rgb(1, 2, 3), ')).toBe(true)
    expect(gradient.endsWith(', rgb(4, 5, 6))')).toBe(true)
  })
})

describe('InfoRow', () => {
  it('holds its height empty, with no swatch or text', () => {
    const { container } = render(<InfoRow />)
    expect(container.firstChild).toBeEmptyDOMElement()
  })
})

describe('usePicture', () => {
  it('requests nothing while not active, then once active', () => {
    const { rerender } = renderHook(({ active }) => usePicture(point, file, 'terrain', active), { initialProps: { active: false } })
    expect(pictures.request).not.toHaveBeenCalled()
    rerender({ active: true })
    expect(pictures.request).toHaveBeenCalledWith(point, file, 'terrain')
  })

  it('updates when the store changes', () => {
    const { result } = renderHook(() => usePicture(point, file, 'data'))
    expect(result.current.entry).toBeUndefined()
    pictures.set(point, 'data', { status: 'loading' })
    expect(result.current.entry?.status).toBe('loading')
  })

  it('stops listening on unmount', () => {
    const { unmount } = renderHook(() => {
      const [count] = useState(0)
      usePicture(point, file, 'data')
      return count
    })
    unmount()
    expect(() => pictures.set(point, 'data', { status: 'loading' })).not.toThrow()
  })
})
