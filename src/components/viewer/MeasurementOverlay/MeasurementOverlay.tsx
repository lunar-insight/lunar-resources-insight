import React, { useEffect, useMemo, useRef } from 'react';
import * as Cesium from 'cesium';
import { useViewer } from 'utils/context/ViewerContext';
import { useMeasurementContext } from 'utils/context/MeasurementContext';
import { MeasurementLineService } from 'services/MeasurementLineService';
import { computeSurfaceDistance, computeTerrainDistance } from 'utils/measurementDistance';
import { computeBeaconTopPosition, applyBeaconProjection } from 'utils/beaconGeometry';
import MeasurementPointMarker from './MeasurementPointMarker';
import MeasurementDistanceLabel from './MeasurementDistanceLabel';
import MeasurementHoverMarker from './MeasurementHoverMarker';

const MeasurementOverlay: React.FC = () => {
  const { viewer } = useViewer();
  const {
    isActive,
    points,
    setPoints,
    distanceMode,
    setDistanceMode,
    distanceMeters,
    setDistanceMeters,
    isDistanceLoading,
    setIsDistanceLoading,
  } = useMeasurementContext();

  const serviceRef = useRef<MeasurementLineService | null>(null);
  if (!serviceRef.current) {
    serviceRef.current = new MeasurementLineService();
  }
  const hoverWrapperRef = useRef<HTMLDivElement>(null);
  const hoverLineRef = useRef<SVGLineElement>(null);

  useEffect(() => {
    const service = serviceRef.current;
    return () => {
      service?.destroy();
    };
  }, []);

  useEffect(() => {
    serviceRef.current?.setViewer(viewer);
  }, [viewer]);

  useEffect(() => {
    serviceRef.current?.setCallbacks(
      (committedPoints) => setPoints(committedPoints),
      (liveMeters) => {
        setDistanceMeters(liveMeters);
        setIsDistanceLoading(false);
      },
      (cartesian) => {
        const wrapper = hoverWrapperRef.current;
        const line = hoverLineRef.current;
        if (!wrapper || !line || !viewer) return;

        if (!cartesian) {
          wrapper.style.display = 'none';
          return;
        }

        const groundScreen = viewer.scene.cartesianToCanvasCoordinates(cartesian);
        const topCartesian = computeBeaconTopPosition(viewer, cartesian);
        const topScreen = viewer.scene.cartesianToCanvasCoordinates(topCartesian);
        applyBeaconProjection(wrapper, line, groundScreen, topScreen);
      }
    );
  }, [viewer, setPoints, setDistanceMeters, setIsDistanceLoading]);

  useEffect(() => {
    if (isActive) {
      serviceRef.current?.start();
    } else {
      serviceRef.current?.stop();
    }
  }, [isActive]);

  useEffect(() => {
    serviceRef.current?.setDistanceMode(distanceMode);
  }, [distanceMode]);

  // Recomputes the committed (non-dragging) distance whenever both points
  // are set or the distance mode changes. Live updates during a drag are
  // reported separately, through the service's onLiveDistance callback.
  useEffect(() => {
    if (points.length !== 2) {
      setDistanceMeters(null);
      setIsDistanceLoading(false);
      return;
    }

    if (distanceMode === 'surface') {
      setDistanceMeters(computeSurfaceDistance(points[0], points[1]));
      setIsDistanceLoading(false);
      return;
    }

    let cancelled = false;
    setIsDistanceLoading(true);
    computeTerrainDistance(points[0], points[1]).then((meters) => {
      if (cancelled) return;
      setDistanceMeters(meters);
      setIsDistanceLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [points, distanceMode, setDistanceMeters, setIsDistanceLoading]);

  const midpoint = useMemo(() => {
    if (points.length !== 2) return null;
    return new Cesium.EllipsoidGeodesic(points[0], points[1]).interpolateUsingFraction(0.5);
  }, [points]);

  if (!viewer) return null;

  return (
    <>
      <MeasurementHoverMarker wrapperRef={hoverWrapperRef} lineRef={hoverLineRef} />
      {points.map((cartographic, index) => (
        <MeasurementPointMarker
          key={index}
          viewer={viewer}
          cartographic={cartographic}
          onDragMove={(cartesian) => serviceRef.current?.previewDrag(index as 0 | 1, cartesian)}
          onDragEnd={(cartesian) => serviceRef.current?.commitDrag(index as 0 | 1, cartesian)}
        />
      ))}
      {midpoint && (
        <MeasurementDistanceLabel
          viewer={viewer}
          cartographic={midpoint}
          distanceMeters={distanceMeters}
          isLoading={isDistanceLoading}
        />
      )}
    </>
  );
};

export default MeasurementOverlay;
