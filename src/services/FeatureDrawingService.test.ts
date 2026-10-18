import * as Cesium from 'cesium'
import { FeatureDrawingService } from './FeatureDrawingService'

describe('the hover cursor', () => {
  function hoverOver(picked: unknown): string {
    const service = new FeatureDrawingService() as any
    const canvas = document.createElement('canvas')
    service.viewer = { canvas, scene: { pick: () => picked } }
    service.lineVertexEditingService.handleHover = () => ({ cursor: 'default', handled: false })
    service.handleHover(new Cesium.Cartesian2(1, 1))
    return canvas.style.cursor
  }

  const entity = (options: Cesium.Entity.ConstructorOptions) => ({ id: new Cesium.Entity(options) })
  const position = Cesium.Cartesian3.fromDegrees(10, 20, 0, Cesium.Ellipsoid.MOON)

  it('offers to grab a polygon or a circle', () => {
    expect(hoverOver(entity({ polygon: { hierarchy: new Cesium.PolygonHierarchy([position, position, position]) } }))).toBe('grab')
    expect(hoverOver(entity({ position, ellipse: { semiMajorAxis: 10, semiMinorAxis: 10 } }))).toBe('grab')
  })

  it('keeps the default cursor elsewhere', () => {
    expect(hoverOver(entity({ position }))).toBe('default')
    expect(hoverOver(undefined)).toBe('default')
  })
})
