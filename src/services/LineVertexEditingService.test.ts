import * as Cesium from 'cesium'
import { LineVertexEditingService } from './LineVertexEditingService'

const picked = (properties?: Record<string, unknown>) => ({ id: new Cesium.Entity({ properties }) })

describe('LineVertexEditingService.isVertexMarker', () => {
  it('recognizes a vertex marker', () => {
    expect(LineVertexEditingService.isVertexMarker(picked({ _isVertexMarker: true }))).toBe(true)
  })

  it('rejects anything else', () => {
    expect(LineVertexEditingService.isVertexMarker(undefined)).toBe(false)
    expect(LineVertexEditingService.isVertexMarker({ id: 'not an entity' })).toBe(false)
    expect(LineVertexEditingService.isVertexMarker(picked())).toBe(false)
    expect(LineVertexEditingService.isVertexMarker(picked({ _isHoverPreview: true }))).toBe(false)
    expect(LineVertexEditingService.isVertexMarker(picked({ _isVertexMarker: false }))).toBe(false)
  })
})

describe('LineVertexEditingService.handleRightClick', () => {
  const viewerPicking = (result: unknown) => ({ scene: { pick: vi.fn(() => result) } }) as unknown as Cesium.CesiumWidget

  it('leaves a click off a vertex to others', () => {
    const service = new LineVertexEditingService()
    expect(service.handleRightClick(new Cesium.Cartesian2(1, 1))).toBe(false)
    service.setViewer(viewerPicking(picked()))
    expect(service.handleRightClick(new Cesium.Cartesian2(1, 1))).toBe(false)
  })

  it('deletes the vertex under the click', () => {
    const service = new LineVertexEditingService() as any
    service.setViewer(viewerPicking(picked({ _isVertexMarker: true, _vertexInfo: { lineId: 'line-1', vertexIndex: 2 } })))
    const deleteVertex = vi.spyOn(service, 'deleteVertex').mockImplementation(() => {})
    expect(service.handleRightClick(new Cesium.Cartesian2(1, 1))).toBe(true)
    expect(deleteVertex).toHaveBeenCalledWith('line-1', 2)
  })
})
