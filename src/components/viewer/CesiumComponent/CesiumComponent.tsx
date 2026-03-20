import React, { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Source/Widgets/widgets.css';
import './CesiumComponent.module.scss';
import { useViewer } from 'utils/context/ViewerContext';
import { pointValueService } from 'services/PointValueService';
import BottomRightControls from '../BottomRightControls/BottomRightControls';
import TopRightControls from '../TopRightControls/TopRightControls';
import { TerrainService } from 'services/TerrainService';

// Skybox images
import positiveX from 'assets/images/skybox/px.jpg';
import negativeX from 'assets/images/skybox/nx.jpg';
import positiveY from 'assets/images/skybox/py.jpg';
import negativeY from 'assets/images/skybox/ny.jpg';
import positiveZ from 'assets/images/skybox/pz.jpg';
import negativeZ from 'assets/images/skybox/nz.jpg';
import { useMouseTrackingControl } from 'hooks/useMouseTrackingControl';
import { useFeaturesContext } from '../../../utils/context/FeaturesContext';

interface CesiumComponentProps {
  className?: string;
}

const CesiumComponent: React.FC<CesiumComponentProps> = ({ className }) => {
  const [isCameraMoving, setIsCameraMoving] = useState(false);
  const [localViewer, setLocalViewer] = useState<Cesium.Viewer | null>(null);
  const [terrainLoaded, setTerrainLoaded] = useState(false);

  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const { setViewer } = useViewer();
  const { activeDrawingTool } = useFeaturesContext();

  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeDrawingToolRef = useRef<string | null>(null);

  useMouseTrackingControl(isCameraMoving, 'cesium-camera');

  // For Cesium initialisation
  useEffect(() => {
    if (cesiumContainerRef.current) {
      Cesium.Ion.defaultAccessToken = ''; // No Cesium Key (to remove the message)
      Cesium.Ellipsoid.default = Cesium.Ellipsoid.MOON

      const mapProjection = new Cesium.GeographicProjection(Cesium.Ellipsoid.default);
      const globe = new Cesium.Globe(Cesium.Ellipsoid.default);

      // Viewer creation
      const viewer = new Cesium.Viewer(cesiumContainerRef.current, {
        globe: globe,
        mapProjection: mapProjection,
        baseLayer: false,            // Disable default Ion imagery (empty token)
        timeline: false,
        animation: false,
        baseLayerPicker: false,
        infoBox: false,
        selectionIndicator: false,
        fullscreenButton: false,
        requestRenderMode: true,
        sceneModePicker: false,
        geocoder: false,
        homeButton: false,
        navigationHelpButton: true,   // Enabled for API access (UI hidden by CSS)
      });

      // Disable automatic display of navigation help on startup
      if (viewer.navigationHelpButton && viewer.navigationHelpButton.viewModel) {
        viewer.navigationHelpButton.viewModel.showInstructions = false;
      }

      /*
          More Cesium option
      */
      globe.baseColor = Cesium.Color.GRAY;

      // Terrain
      globe.depthTestAgainstTerrain = false;
      globe.showWaterEffect = false;

      // Remove the default double click of Cesium that can conflict with custom selection tools
      viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
        Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
      );

      // Remove Ion credit
      viewer.cesiumWidget.creditContainer.parentNode?.removeChild(
        viewer.cesiumWidget.creditContainer
      );

      viewer.scene.skyBox = new Cesium.SkyBox({
        sources: {
          positiveX,
          negativeX,
          positiveY,
          negativeY,
          positiveZ,
          negativeZ,
        }
      });

      // Primary imagery layer creation
      const baseLayer = new Cesium.ImageryLayer(
        new Cesium.WebMapServiceImageryProvider({
          // Dev only:
          url: 'https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/earth/moon_simp_cyl.map&service=WMS',
          layers: 'LROC_WAC',
          parameters: {
            transparent: false,
            format: 'image/png'
          },
          tileWidth: 512,
          tileHeight: 512,
        }),
        // { show: true }
      );

      // Add the primary layer to the viewer
      viewer.imageryLayers.add(baseLayer);

      // Grab cursor style management
      const canvas = viewer.cesiumWidget.canvas;
      const handler = viewer.cesiumWidget.screenSpaceEventHandler;

      const startMovement = () => {
        setIsCameraMoving(true);
      };

      const endMovement = () => {
        // Delay to avoid flickering
        setTimeout(() => {
          setIsCameraMoving(false);
        }, 100);
      };

      const mouseLeaveHandler = () => {
        canvas.style.cursor = 'default';
      };

      const mouseEnterHandler = () => {
        // Restore correct cursor when entering canvas
        if (activeDrawingToolRef.current) {
          canvas.style.cursor = 'crosshair';
        } else {
          canvas.style.cursor = 'default';
        }
      };

      const moveStartRemover = viewer.camera.moveStart.addEventListener(startMovement);
      const moveEndRemover = viewer.camera.moveEnd.addEventListener(endMovement);

      // Event listeners for mouse drag (backup in case of problems with camera events)
      handler.setInputAction(() => {
        canvas.style.cursor = 'grabbing';
      }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

      handler.setInputAction(() => {
        canvas.style.cursor = 'default';
      }, Cesium.ScreenSpaceEventType.LEFT_UP);

      // Initialize terrain async
      let isMounted = true;
      const initTerrain = async () => {
        try {
          // Quantized mesh terrain
          const terrainUrl = process.env.REACT_APP_TERRAIN_URL || 'http://localhost:3001';
          const terrainProvider = await TerrainService.initializeLocalTerrain(terrainUrl);
        
          // Check if component if still mounted before updating state
          if (!isMounted) return;
          
          viewer.terrainProvider = terrainProvider;

          console.log('Terrain loaded successfully');
          setTerrainLoaded(true);

          // Request render after terrain loads
          viewer.scene.requestRender();
        } catch (error) {
          // Check if component is still mounted before updating state
          if (!isMounted) return;

          console.error('Failed to load terrain, using ellipsoid:', error);

          // Fallback to ellipsoid terrain (flat terrain)
          viewer.terrainProvider = TerrainService.createEllipsoidTerrain();
          setTerrainLoaded(false);
        }
      };

      initTerrain();

      setViewer(viewer);
      setLocalViewer(viewer);

      // Error handling for the base layer
      baseLayer.imageryProvider.errorEvent.addEventListener((error) => {
        console.error('Error loading base imagery layer:', error);
      });

      canvas.addEventListener('mouseleave', mouseLeaveHandler);
      canvas.addEventListener('mouseenter', mouseEnterHandler);

      // Cleanup function
      return () => {

        if (resumeTimeoutRef.current) {
          clearTimeout(resumeTimeoutRef.current);
        }

        if (moveStartRemover) {
          moveStartRemover();
        }
        if (moveEndRemover) {
          moveEndRemover();
        }

        canvas.removeEventListener('mouseleave', mouseLeaveHandler);
        canvas.removeEventListener('mouseenter', mouseEnterHandler)

        // Re-enable mouse tracking on cleanup
        pointValueService.enableMouseTracking();
      };
    }
  }, [setViewer]);
  
  // Update cursor based on active drawing tool
  useEffect(() => {
    if (!localViewer) return;

    // Update ref so event handlers can access current value
    activeDrawingToolRef.current = activeDrawingTool;

    const canvas = localViewer.cesiumWidget.canvas;
    const handler = localViewer.cesiumWidget.screenSpaceEventHandler;

    if (activeDrawingTool) {
      // In selection mode, use crosshair cursor
      canvas.style.cursor = 'crosshair';

      // Override the default grab/grabbing behavior during selection mode
      const leftDownHandler = handler.getInputAction(Cesium.ScreenSpaceEventType.LEFT_DOWN);
      const leftUpHandler = handler.getInputAction(Cesium.ScreenSpaceEventType.LEFT_UP);

      // Remove default handlers
      handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOWN);
      handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_UP);

      // Set handlers that maintain crosshair
      handler.setInputAction(() => {
        canvas.style.cursor = 'crosshair';
      }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

      handler.setInputAction(() => {
        canvas.style.cursor = 'crosshair';
      }, Cesium.ScreenSpaceEventType.LEFT_UP);

      // Cleanup: restore original handlers when leaving selection mode
      return () => {
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOWN);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_UP);

        // Restore default grab/grabbing behavior
        handler.setInputAction(() => {
          canvas.style.cursor = 'grabbing';
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

        handler.setInputAction(() => {
          canvas.style.cursor = 'default';
        }, Cesium.ScreenSpaceEventType.LEFT_UP);
      };
    } else {
      // Not in selection mode, use default cursor
      canvas.style.cursor = 'default';
    }
  }, [activeDrawingTool, localViewer]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={cesiumContainerRef} className={className} />
      <BottomRightControls viewer={localViewer} />
      <TopRightControls />
    </div>
  );
};

export default CesiumComponent;