import React, { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Source/Widgets/widgets.css'
import * as geoconfig from 'geoconfig'

// The Cesium css is edited on the MainPage component

const CesiumComponent = ({ className }: { className?: string }) => {
  
  useEffect(() => {
    Cesium.Ion.defaultAccessToken = ''; // No Cesium Key (remove the message)

    const ellipsoid = new Cesium.Ellipsoid(1737400, 1737400, 1737400); // Moon ellipsoid
    const mapProjection = new Cesium.GeographicProjection(ellipsoid);
    const globe = new Cesium.Globe(ellipsoid);

    // Viewer creation
    const viewer = new Cesium.Viewer('cesiumContainer', {
      globe: globe,
      mapProjection: mapProjection,
      timeline: false,
      animation: false,
      baseLayerPicker: false,
      infoBox: false,
      selectionIndicator: false,
    });

    // Primary imagery layer creation
    const baseLayer = new Cesium.ImageryLayer(
      new Cesium.WebMapServiceImageryProvider({
        url: `${geoconfig.mapServerWmsUrl}`,
        layers: `${geoconfig.mapServerWorkspaceName}:${geoconfig.layersConfig.baseLayer.mapName}`,
        //url: 'https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/earth/moon_simp_cyl.map&service=WMS',
        //layers: 'LROC_WAC',
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

  }, []);

  return (
    <div id="cesiumContainer" className={className} />
  );
};

export default CesiumComponent;