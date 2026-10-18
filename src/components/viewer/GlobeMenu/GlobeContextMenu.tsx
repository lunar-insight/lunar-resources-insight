import React, { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import { Menu, MenuItem, Popover, type Key } from 'react-aria-components';
import { useViewer } from 'utils/context/ViewerContext';
import { useFeaturesContext } from 'utils/context/FeaturesContext';
import { useMeasurementContext } from 'utils/context/MeasurementContext';
import { GLOBE_POPUP_ATTRIBUTE, useGlobePopup, type GlobeMenuPopup } from 'utils/context/GlobePopupContext';
import { usePointDrop } from 'utils/context/PointDropContext';
import { DrawingUtils } from 'services/drawing/DrawingUtils';
import { LineVertexEditingService } from 'services/LineVertexEditingService';
import { sampleElevation } from 'services/inspector/inspectorRequests';
import { formatCoordinatePair } from 'utils/featurePointNaming';
import { useCopyCoordinates } from 'hooks/useCopyCoordinates';
import styles from './GlobeContextMenu.module.scss';

const formatMeters = (meters: number) => `${Math.round(meters).toLocaleString('en-US')} m`;

/** Terrain elevation at the menu's spot: undefined while sampling, null without terrain. */
function useMenuElevation(menu: GlobeMenuPopup | null): number | null | undefined {
  const [sample, setSample] = useState<{ menu: GlobeMenuPopup; meters: number | null } | null>(null);

  useEffect(() => {
    if (!menu) return;
    let cancelled = false;
    sampleElevation([{ lon: menu.lon, lat: menu.lat }])
      .then(elevation => elevation?.value ?? null, (): null => null)
      .then(meters => {
        if (!cancelled) setSample({ menu, meters });
      });
    return () => {
      cancelled = true;
    };
  }, [menu]);

  return sample && sample.menu === menu ? sample.meters : undefined;
}

/**
 * The menu a right click on the ground opens: the coordinate and the
 * elevation, then "Create point" and "Copy coordinates". A right click that
 * an active tool uses (finishing a line or polygon, canceling a measurement,
 * deleting a line vertex) opens nothing. Cesium fires RIGHT_CLICK only when
 * the mouse moved less than its click tolerance, so a right-drag zoom never
 * opens it. Must be mounted inside .viewerContainer, since the click position
 * is relative to the canvas.
 */
const GlobeContextMenu: React.FC = () => {
  const { viewer } = useViewer();
  const { features, activeDrawingTool } = useFeaturesContext();
  const { isActive: isMeasuring } = useMeasurementContext();
  const { popup, openMenu, closePopup, closeMenuKeepingHold } = useGlobePopup();
  const { dropPoint } = usePointDrop();
  const copyCoordinates = useCopyCoordinates();
  const anchorRef = useRef<HTMLDivElement>(null);
  const menu = popup?.kind === 'menu' ? popup : null;
  const elevation = useMenuElevation(menu);

  // Read by the Cesium handlers, which are set up once per viewer.
  const stateRef = useRef({ activeDrawingTool, isMeasuring, hasLines: false, openMenu });
  stateRef.current = {
    activeDrawingTool,
    isMeasuring,
    hasLines: features.some(feature => feature.type === 'line'),
    openMenu,
  };

  useEffect(() => {
    if (!viewer) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
    // Checked at the press, before the vertex editing's own click handler
    // deletes the vertex. Picking only runs when a line exists.
    let pressedOnVertex = false;

    handler.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      pressedOnVertex = stateRef.current.hasLines
        && LineVertexEditingService.isVertexMarker(viewer.scene.pick(event.position));
    }, Cesium.ScreenSpaceEventType.RIGHT_DOWN);

    handler.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const state = stateRef.current;
      if (state.activeDrawingTool || state.isMeasuring || pressedOnVertex) return;

      const position = DrawingUtils.pickGlobePosition(viewer, event.position);
      if (position) state.openMenu({ x: event.position.x, y: event.position.y }, position);
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    return () => handler.destroy();
  }, [viewer]);

  // The menu stays at the screen position of the click, so it closes once the camera moves.
  const isMenuOpen = menu !== null;
  useEffect(() => {
    if (!viewer || !isMenuOpen) return;
    return viewer.camera.moveStart.addEventListener(closePopup);
  }, [viewer, isMenuOpen, closePopup]);

  if (!menu) return null;

  const coordinate = formatCoordinatePair(menu.lat, menu.lon);

  const handleAction = (key: Key) => {
    if (key === 'create') {
      dropPoint(menu.position, closeMenuKeepingHold());
    } else {
      void copyCoordinates(menu.lat, menu.lon);
      closePopup();
    }
  };

  return (
    <React.Fragment key={menu.holdToken}>
      <div ref={anchorRef} className={styles.anchor} style={{ left: menu.screen.x, top: menu.screen.y }} />
      <Popover
        triggerRef={anchorRef}
        isOpen
        isNonModal
        placement="bottom start"
        offset={4}
        className={styles.popover}
        // Only ever reports closing, since the menu opens from the globe.
        onOpenChange={closePopup}
      >
        <div {...{ [GLOBE_POPUP_ATTRIBUTE]: '' }} className={styles.content} onContextMenu={(event) => event.preventDefault()}>
          <div className={styles.header}>
            <div className={styles.coordinate}>{coordinate}</div>
            {elevation !== null && (
              <div className={styles.elevation}>
                Elevation <span className={styles.elevationValue}>{elevation === undefined ? '…' : formatMeters(elevation)}</span>
              </div>
            )}
          </div>
          <Menu aria-label={`Actions at ${coordinate}`} autoFocus="first" onAction={handleAction} className={styles.menu}>
            <MenuItem id="create" textValue="Create point" className={styles.item}>
              <span className="material-symbols-outlined" aria-hidden="true">add_location_alt</span>
              Create point
            </MenuItem>
            <MenuItem id="copy" textValue="Copy coordinates" className={styles.item}>
              <span className="material-symbols-outlined" aria-hidden="true">content_copy</span>
              Copy coordinates
            </MenuItem>
          </Menu>
        </div>
      </Popover>
    </React.Fragment>
  );
};

export default GlobeContextMenu;
