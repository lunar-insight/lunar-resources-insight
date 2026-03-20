import * as Cesium from 'cesium';

export class TerrainService {
  private static terrainProvider: Cesium.CesiumTerrainProvider | null = null;

  // Initialize terrain provider from quantized mesh tiles
  static async initializeLocalTerrain(
    baseUrl: string = '/terrain'
  ): Promise<Cesium.CesiumTerrainProvider> {
    // Input validation
    if (!baseUrl || typeof baseUrl !== 'string' || baseUrl.trim() === '') {
      throw new Error('Invalid baseUrl: must be a non-empty string');
    }

    try {
      const terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl(baseUrl, {
        requestVertexNormals: false,
        requestWaterMask: false,
        requestMetadata: false,
      });

      this.terrainProvider = terrainProvider;
      return terrainProvider;
    } catch (error) {
      console.error('Failed to load terrain Provider:', error);
      throw error;
    }
  }

  // Create an ellipsoid terrain provider (fallback with no elevation)
  static createEllipsoidTerrain(): Cesium.EllipsoidTerrainProvider {
    return new Cesium.EllipsoidTerrainProvider({
      ellipsoid: Cesium.Ellipsoid.MOON,
    });
  }

  // Get the current terrain provider
  static getTerrainProvider(): Cesium.TerrainProvider | null {
    return this.terrainProvider;
  }

  // Sample terrain height at a given position
  static async sampleTerrainHeight(
    position: Cesium.Cartographic,
    level: number = 11
  ): Promise<number | undefined> {
    if (!this.terrainProvider) {
      console.warn('Terrain provider not initialized');
      return undefined
    }

    // Check if it's actually a CesiumTerrainProvider (not EllipsoidTerrainProvider)
    if (!(this.terrainProvider instanceof Cesium.CesiumTerrainProvider)) {
      console.warn('Terrain sampling requires CesiumTerrainProvider, not EllipsoidTerrainProvider');
      return undefined;
    }

    try {
      const positions = [position];
      const updatedPositions = await Cesium.sampleTerrain(
        this.terrainProvider,
        level,
        positions
      );

      return updatedPositions[0].height;
    } catch (error) {
      console.error('Failed to sample terrain:', error);
      return undefined;
    }
  }

  // Sample terrain heights for multiple positions
  static async sampleTerrainHeights(
    positions: Cesium.Cartographic[],
    level: number = 11
  ): Promise<Cesium.Cartographic[]> {
    if (!this.terrainProvider) {
      console.warn('Terrain provider not initialized');
      return positions;
    }

    // Check if it's actually a CesiumTerrainProvider (not EllipsoidTerrainProvider)
    if (!(this.terrainProvider instanceof Cesium.CesiumTerrainProvider)) {
      console.warn('Terrain sampling requires CesiumTerrainProvider, not EllipsoidTerrainProvider')
      return positions;
    }

    try {
      return await Cesium.sampleTerrain(
        this.terrainProvider,
        level,
        positions
      );
    } catch (error) {
      console.error('Failed to sample terrain:', error);
      return positions;
    }
  }

  // Clear terrain provider reference
  static clearTerrainProvider(): void {
    this.terrainProvider = null;
  }
}

