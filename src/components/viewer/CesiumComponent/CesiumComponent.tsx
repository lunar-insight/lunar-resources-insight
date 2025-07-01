import React, { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Source/Widgets/widgets.css';
import { useViewer } from '../../../utils/context/ViewerContext';

// Skybox images
import positiveX from '@assets/images/skybox/px.jpg';
import negativeX from '@assets/images/skybox/nx.jpg';
import positiveY from '@assets/images/skybox/py.jpg';
import negativeY from '@assets/images/skybox/ny.jpg';
import positiveZ from '@assets/images/skybox/pz.jpg';
import negativeZ from '@assets/images/skybox/nz.jpg';

// Info: The Cesium CSS is edited on the MainPage component

interface CesiumComponentProps {
  className?: string;
}

const CesiumComponent: React.FC<CesiumComponentProps> = ({ className }) => {
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const { setViewer } = useViewer();

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
        timeline: false,
        animation: false,
        baseLayerPicker: false,
        infoBox: false,
        selectionIndicator: false,
        requestRenderMode: true,
      });

      /*
          More Cesium option
      */
      globe.baseColor = Cesium.Color.GRAY;

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

      handler.setInputAction(() => {
        canvas.style.cursor = 'grabbing';
      }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

      handler.setInputAction(() => {
        canvas.style.cursor = 'default';
      }, Cesium.ScreenSpaceEventType.LEFT_UP);

      canvas.addEventListener('mouseleave', () => {
        canvas.style.cursor = 'default';
      });

      setViewer(viewer);

      // Error handling for the base layer
      baseLayer.imageryProvider.errorEvent.addEventListener((error) => {
        console.error('Error loading base imagery layer:', error);
      });

      // Cleanup function
      return () => {
        canvas.removeEventListener('mouseleave', () => {
          canvas.style.cursor = 'default';
        });
      };
    }
  }, [setViewer]);

  return (
    <div ref={cesiumContainerRef} className={className} />
  );
};

export default CesiumComponent;