import * as Cesium from 'cesium';
import { Feature } from 'components/navigation/FeaturesSection/types';

/**
 * Calculates the center position of a feature based on its type
 */
export const getFeatureCenterPosition = (feature: Feature): Cesium.Cartographic | null => {
  const { type, metadata } = feature;

  switch (type) {
    case 'point':
      return metadata.position || null;

    case 'circle':
      return metadata.center || null;

    case 'two-point-circle':
    case 'three-point-circle':
      return metadata.centerPosition || null;

    case 'line':
    case 'polygon':
      if (!metadata.positions || metadata.positions.length === 0) {
        return null;
      }
      // Calculate the centroid of the positions
      const positions = metadata.positions;
      const sumLon = positions.reduce((sum, pos) => sum + pos.longitude, 0);
      const sumLat = positions.reduce((sum, pos) => sum + pos.latitude, 0);
      const sumHeight = positions.reduce((sum, pos) => sum + pos.height, 0);

      return new Cesium.Cartographic(
        sumLon / positions.length,
        sumLat / positions.length,
        sumHeight / positions.length
      );

    default:
      return null;
  }
};

/**
 * Gets all positions that define a feature's boundaries
 */
const getFeaturePositions = (feature: Feature): Cesium.Cartographic[] => {
  const { type, metadata } = feature;

  switch (type) {
    case 'point':
      return metadata.position ? [metadata.position] : [];

    case 'circle':
      if (!metadata.center || !metadata.radius) return [];
      // For circle, get points around the perimeter for bounding box
      const circlePoints: Cesium.Cartographic[] = [];
      const numPoints = 36; // Sample 36 points around the circle
      const centerCart = Cesium.Cartesian3.fromRadians(
        metadata.center.longitude,
        metadata.center.latitude,
        metadata.center.height
      );

      // Use Cesium's ellipsoid to calculate points on the surface at the correct distance
      const ellipsoid = Cesium.Ellipsoid.MOON;
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;

        // Calculate north and east vectors in local ENU (East-North-Up) coordinate system
        const normal = ellipsoid.geodeticSurfaceNormal(centerCart);
        const east = Cesium.Cartesian3.cross(Cesium.Cartesian3.UNIT_Z, normal, new Cesium.Cartesian3());
        Cesium.Cartesian3.normalize(east, east);
        const north = Cesium.Cartesian3.cross(normal, east, new Cesium.Cartesian3());
        Cesium.Cartesian3.normalize(north, north);

        // Calculate offset at the specified bearing
        const offsetEast = Math.sin(angle) * metadata.radius;
        const offsetNorth = Math.cos(angle) * metadata.radius;

        const offset = new Cesium.Cartesian3();
        Cesium.Cartesian3.multiplyByScalar(east, offsetEast, offset);
        const northOffset = Cesium.Cartesian3.multiplyByScalar(north, offsetNorth, new Cesium.Cartesian3());
        Cesium.Cartesian3.add(offset, northOffset, offset);

        const position = Cesium.Cartesian3.add(centerCart, offset, new Cesium.Cartesian3());
        circlePoints.push(Cesium.Cartographic.fromCartesian(position, ellipsoid));
      }
      return circlePoints;

    case 'two-point-circle':
      if (metadata.diameterEndpoints && metadata.diameterEndpoints.length >= 2) {
        // Use diameter endpoints to calculate radius and sample perimeter
        const center = metadata.centerPosition;
        if (!center) return metadata.diameterEndpoints;

        const centerCart = Cesium.Cartesian3.fromRadians(center.longitude, center.latitude, center.height);
        const edgeCart = Cesium.Cartesian3.fromRadians(
          metadata.diameterEndpoints[0].longitude,
          metadata.diameterEndpoints[0].latitude,
          metadata.diameterEndpoints[0].height
        );
        const radius = Cesium.Cartesian3.distance(centerCart, edgeCart);

        const circlePoints: Cesium.Cartographic[] = [];
        const numPoints = 36;
        for (let i = 0; i < numPoints; i++) {
          const angle = (i / numPoints) * Math.PI * 2;
          const offset = new Cesium.Cartesian3(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            0
          );
          const position = Cesium.Cartesian3.add(centerCart, offset, new Cesium.Cartesian3());
          circlePoints.push(Cesium.Cartographic.fromCartesian(position));
        }
        return circlePoints;
      }
      return [];

    case 'three-point-circle':
      if (metadata.circumferencePoints && metadata.circumferencePoints.length >= 3) {
        const center = metadata.centerPosition;
        if (!center) return metadata.circumferencePoints;

        const centerCart = Cesium.Cartesian3.fromRadians(center.longitude, center.latitude, center.height);
        const edgeCart = Cesium.Cartesian3.fromRadians(
          metadata.circumferencePoints[0].longitude,
          metadata.circumferencePoints[0].latitude,
          metadata.circumferencePoints[0].height
        );
        const radius = Cesium.Cartesian3.distance(centerCart, edgeCart);

        const circlePoints: Cesium.Cartographic[] = [];
        const numPoints = 36;
        for (let i = 0; i < numPoints; i++) {
          const angle = (i / numPoints) * Math.PI * 2;
          const offset = new Cesium.Cartesian3(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            0
          );
          const position = Cesium.Cartesian3.add(centerCart, offset, new Cesium.Cartesian3());
          circlePoints.push(Cesium.Cartographic.fromCartesian(position));
        }
        return circlePoints;
      }
      return [];

    case 'line':
    case 'polygon':
      return metadata.positions || [];

    default:
      return [];
  }
};

/**
 * Calculates the bounding rectangle for a feature
 */
const getFeatureBounds = (feature: Feature): Cesium.Rectangle | null => {
  const positions = getFeaturePositions(feature);
  if (positions.length === 0) return null;

  let west = positions[0].longitude;
  let south = positions[0].latitude;
  let east = positions[0].longitude;
  let north = positions[0].latitude;

  for (const pos of positions) {
    west = Math.min(west, pos.longitude);
    south = Math.min(south, pos.latitude);
    east = Math.max(east, pos.longitude);
    north = Math.max(north, pos.latitude);
  }

  return new Cesium.Rectangle(west, south, east, north);
};

/**
 * Calculates the appropriate camera distance to view the entire feature
 */
const calculateCameraDistance = (
  bounds: Cesium.Rectangle,
  viewer: Cesium.Viewer
): number => {
  // Calculate the diagonal distance of the bounding rectangle
  const southWest = Cesium.Cartesian3.fromRadians(bounds.west, bounds.south);
  const northEast = Cesium.Cartesian3.fromRadians(bounds.east, bounds.north);
  const diagonalDistance = Cesium.Cartesian3.distance(southWest, northEast);

  // Get the camera's field of view
  const fov = viewer.camera.frustum instanceof Cesium.PerspectiveFrustum
    ? viewer.camera.frustum.fov
    : Cesium.Math.toRadians(60); // Default FOV

  // Calculate the distance needed to fit the feature in view
  // For a top-down view (pitch = -90°), we use the vertical FOV
  const distance = (diagonalDistance / 2) / Math.tan(fov / 2);

  // Add a padding factor to ensure the feature is not at the edge of the screen
  const paddingFactor = 2.0;
  const minDistance = 1000; // Minimum distance of 1km

  return Math.max(distance * paddingFactor, minDistance);
};

/**
 * Flies the camera to a feature with adaptive zoom and top-down view
 */
export const flyToFeature = (
  viewer: Cesium.Viewer | null,
  feature: Feature,
  duration: number = 1.0
): void => {
  if (!viewer) return;

  const centerPosition = getFeatureCenterPosition(feature);
  if (!centerPosition) return;

  const bounds = getFeatureBounds(feature);
  const cameraDistance = bounds
    ? calculateCameraDistance(bounds, viewer)
    : 5000; // Fallback to 5km if bounds cannot be calculated

  const destination = Cesium.Cartesian3.fromRadians(
    centerPosition.longitude,
    centerPosition.latitude,
    centerPosition.height + cameraDistance
  );

  viewer.camera.flyTo({
    destination,
    orientation: {
      heading: Cesium.Math.toRadians(0), // North orientation
      pitch: Cesium.Math.toRadians(-90), // Top-down view (90° angle)
      roll: 0,
    },
    duration,
    easingFunction: Cesium.EasingFunction.CUBIC_OUT,
  });
};
