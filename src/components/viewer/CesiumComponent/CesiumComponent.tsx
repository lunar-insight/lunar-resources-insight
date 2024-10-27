import React, { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Source/Widgets/widgets.css';
import { mapServerWmsUrl } from '../../../geoConfigExporter';
import { useLayerContext } from '../../../utils/context/LayerContext';

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
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const { selectedLayers } = useLayerContext();
  const addedLayersRef = useRef<Map<string, Cesium.ImageryLayer>>(new Map());

  // For Cesium initialisation
  useEffect(() => {
    if (cesiumContainerRef.current && !viewerRef.current) {

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
      });

      viewerRef.current = viewer; // Stock the viewer instance in the reference

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
        { show: true }
      );

      // Add the primary layer to the viewer
      viewer.imageryLayers.add(baseLayer);

      // Remove the default double click of Cesium that can conflict with custom selection tools
      viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

      /*
          More Cesium option
      */
      globe.baseColor = Cesium.Color.GRAY;
      
      // Remove Ion credit
      viewer.cesiumWidget.creditContainer.parentNode?.removeChild(viewer.cesiumWidget.creditContainer);

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

      // Error handling for the base layer
      baseLayer.imageryProvider.errorEvent.addEventListener((error) => {
        console.error('Error loading base imagery layer:', error);
      });
    }
  }, []);

  // For layer changes
  useEffect(() => {
    if (!viewerRef.current) return;

    const viewer = viewerRef.current;

    // Add selected layers
    selectedLayers.forEach(layerName => {
      if (!addedLayersRef.current.has(layerName)) {
        const imageryProvider = new Cesium.WebMapServiceImageryProvider({
          url: mapServerWmsUrl,
          layers: layerName,
          parameters: {
            service: 'WMS',
            version: '1.1.1',
            request: 'GetMap',
            format: 'image/png',
            transparent: true,
            styles: '',
            srs: 'IAU:30100'
          },
          tileWidth: 256,
          tileHeight: 256,
        });

        // Error handling for the imagery provider
        imageryProvider.errorEvent.addEventListener((error) => {
          console.error(`Error loading imagery layer '${layerName}':`, error);
        })

        const imageryLayer = new Cesium.ImageryLayer(imageryProvider, { show: true });
        viewer.imageryLayers.add(imageryLayer);
        addedLayersRef.current.set(layerName, imageryLayer);
      }
    });

    // Remove the layer that are not selected anymore
    Array.from(addedLayersRef.current.keys()).forEach(layerName => {
      if (!selectedLayers.includes(layerName)) {
        const imageryLayer = addedLayersRef.current.get(layerName);
        if (imageryLayer) {
          try {
            if (!imageryLayer.isDestroyed()) {
              viewer.imageryLayers.remove(imageryLayer, true); // Also destroy() with the boolean
            }
          } catch (error) {
            console.warn(`Error removing layer ${layerName}:`, error);
          }
          addedLayersRef.current.delete(layerName);
        }
      }
    });
  }, [selectedLayers])

  return (
    <div ref={cesiumContainerRef} className={className} />
  );
};

export default CesiumComponent;