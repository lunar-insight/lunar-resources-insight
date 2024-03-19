import React, { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Source/Widgets/widgets.css'
import * as geoconfig from 'geoconfig'

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
  const viewerRef = useRef<Cesium.Viewer | null>(null); // If necessary in the future

  useEffect(() => {
    if (cesiumContainerRef.current && !viewerRef.current) {

      Cesium.Ion.defaultAccessToken = ''; // No Cesium Key (to remove the message)

      const ellipsoid = new Cesium.Ellipsoid(1737400, 1737400, 1737400); // Moon ellipsoid
      const mapProjection = new Cesium.GeographicProjection(ellipsoid);
      const globe = new Cesium.Globe(ellipsoid);

      // Viewer creation
      const viewer = new Cesium.Viewer(cesiumContainerRef.current, {
        globe: globe,
        mapProjection: mapProjection,
        timeline: false,
        animation: false,
        baseLayerPicker: false,
        infoBox: false,
        selectionIndicator: false,
      });

      viewerRef.current = viewer; // Stock the viewer instance in the reference

      // Primary imagery layer creation
      const baseLayer = new Cesium.ImageryLayer(
        new Cesium.WebMapServiceImageryProvider({
          // Production purpose:
          //url: `${geoconfig.mapServerWmsUrl}`,
          //layers: `${geoconfig.mapServerWorkspaceName}:${geoconfig.layersConfig.baseLayer.mapName}`,
          // Dev purpose:
          url: 'https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/earth/moon_simp_cyl.map&service=WMS',
          layers: 'LROC_WAC',
          parameters: {
            transparent: false,
            format: 'image/png'
          },
          tileWidth: 512,
          tileHeight: 512,
        }),
        {
          show: true
        }
      );

      // Add the primary layer to the viewer
      viewer.imageryLayers.add(baseLayer);

      // Remove the default double click of Cesium that can conflict with custom selection tools
      viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

      /*
          More Cesium option
      */
      globe.showGroundAtmosphere = false;
      globe.baseColor = Cesium.Color.BLACK;
      viewer.scene.fog.enabled = false;
      viewer.scene.moon.show = false;
      viewer.scene.sun.show = false;
      viewer.scene.skyAtmosphere.show = false;
      viewer.scene.shadowMap.enabled = false;
      
      // Remove Ion credit
      viewer.cesiumWidget.creditContainer.parentNode.removeChild(viewer.cesiumWidget.creditContainer);

      // Skybox creation
      viewer.scene.skyBox = new Cesium.SkyBox({
        sources: {
          positiveX: positiveX,
          negativeX: negativeX,
          positiveY: positiveY,
          negativeY: negativeY,
          positiveZ: positiveZ,
          negativeZ: negativeZ,
        }
      });
    }
    
    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null; // Reference reinitialized after destruction
      }
    };

  }, []);

  return (
    <div ref={cesiumContainerRef} className={className} />
  );
};

export default CesiumComponent;