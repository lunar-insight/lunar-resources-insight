import * as Cesium from 'cesium';

// Amber teardrop pin, deliberately distinct from the cyan dots used by saved
// feature points so users can tell "unsaved search result" apart from "saved feature".
const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
  <path d="M16 0C7.163 0 0 7.163 0 16c0 11 16 26 16 26s16-15 16-26C32 7.163 24.837 0 16 0z" fill="#FFB020" stroke="#FFFFFF" stroke-width="2"/>
  <circle cx="16" cy="16" r="6" fill="#FFFFFF"/>
</svg>`;
const PIN_IMAGE = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(PIN_SVG)}`;

export interface SearchResultMarkerPosition {
  lon: number;
  lat: number;
}

/**
 * Manages the single temporary pin entity shown when a nomenclature/coordinate
 * search result is selected. At most one instance is ever visible, showing a
 * new position replaces the previous pin rather than accumulating markers.
 */
export class SearchResultMarkerService {
  private viewer: Cesium.Viewer | null = null;
  private entity: Cesium.Entity | null = null;
  private position: Cesium.Cartesian3 | null = null;
  private lonLat: SearchResultMarkerPosition | null = null;

  setViewer(viewer: Cesium.Viewer | null) {
    this.viewer = viewer;
  }

  show(lon: number, lat: number) {
    if (!this.viewer) return;

    this.clear();

    this.position = Cesium.Cartesian3.fromDegrees(lon, lat, 0);
    this.lonLat = { lon, lat };

    this.entity = this.viewer.entities.add({
      position: this.position,
      properties: { _isSearchResultMarker: true },
      billboard: {
        image: PIN_IMAGE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  }

  clear() {
    if (this.viewer && this.entity) {
      this.viewer.entities.remove(this.entity);
    }
    this.entity = null;
    this.position = null;
    this.lonLat = null;
  }

  isActive(): boolean {
    return this.entity !== null;
  }

  getPosition(): SearchResultMarkerPosition | null {
    return this.lonLat;
  }

  /** Screen-space coordinates of the pin, or null if not shown / not currently visible. */
  getScreenPosition(): Cesium.Cartesian2 | null {
    if (!this.viewer || !this.position) return null;
    return this.viewer.scene.cartesianToCanvasCoordinates(this.position) ?? null;
  }

  destroy() {
    this.clear();
    this.viewer = null;
  }
}
