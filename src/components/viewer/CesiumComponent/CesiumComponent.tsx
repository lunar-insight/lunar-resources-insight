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
import { useViewer } from 'utils/context/ViewerContext';


// Info: The Cesium CSS is edited on the MainPage component

interface CesiumComponentProps {
  className?: string;
}

const CesiumComponent: React.FC<CesiumComponentProps> = ({ className }) => {
  const cesiumContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const { selectedLayers, visibleLayers } = useLayerContext();
  const addedLayersRef = useRef<Map<string, Cesium.ImageryLayer>>(new Map());
  const previousLayerRef = useRef<string[]>([]);
  const baseLayerRef = useRef<Cesium.ImageryLayer | null>(null);
  const previousVisibleLayersRef = useRef<Set<string>>(new Set());
  const { setViewer } = useViewer();

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
        requestRenderMode: true,
      });

      viewerRef.current = viewer; // Stock the viewer instance in the reference
      setViewer(viewer) // Share viewer via context

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

      // Store base layer reference
      baseLayerRef.current = baseLayer;

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
  }, [setViewer]);

  // For layer management
  useEffect(() => {
    if (!viewerRef.current || !selectedLayers) return;
    const viewer = viewerRef.current;

    // Check if it is a reorder or a standard modification
    const isReorder = selectedLayers.length === previousLayerRef.current.length &&
      selectedLayers.length > 1 &&
      selectedLayers.every(layer => previousLayerRef.current.includes(layer));

    if (!isReorder) {

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

    } else {

      try {

        // Temporary table to register actual layer order (without baseLayer)
        const tempLayers = Array.from({ length: viewer.imageryLayers.length - 1 },
          (_, i) => viewer.imageryLayers.get(i + 1));

        // Remove all the layer, without removing the base layer
        for (let i = viewer.imageryLayers.length - 1; i > 0; i--) {
          const layerToRemove = viewer.imageryLayers.get(i);
          if (layerToRemove !== baseLayerRef.current) {
            viewer.imageryLayers.remove(layerToRemove, false);
          }
        }

        // Re-add the layer in the new order
        selectedLayers.forEach(layerName => {
          const layer = addedLayersRef.current.get(layerName);
          if (layer && tempLayers.includes(layer)) {
            viewer.imageryLayers.add(layer);
          }
        });
      } catch (error) {
        console.warn('Error while reordering layers:', error);
      }
    }

    previousLayerRef.current = [...selectedLayers]; // Save the new order
  }, [selectedLayers]);

  // Handle layer visibility change
  useEffect(() => {
    if (!viewerRef.current) return;

    const currentVisibleLayers = new Set(visibleLayers);
    const previousVisibleLayers = previousVisibleLayersRef.current;

    // Check for newly hidden layers
    Array.from(previousVisibleLayers).forEach(layerName => {
      if (!currentVisibleLayers.has(layerName)) {
        const layer = addedLayersRef.current.get(layerName);
        if (layer && !layer.isDestroyed()) {
          layer.show = false;
        }
      }
    })

    // Check for newly visible layers
    Array.from(currentVisibleLayers).forEach(layerName => {
      if (!previousVisibleLayers.has(layerName)) {
        const layer = addedLayersRef.current.get(layerName);
        if (layer && !layer.isDestroyed()) {
          layer.show = true;
        }
      }
    });

    previousVisibleLayersRef.current = new Set(visibleLayers);
  }, [visibleLayers]);


  return (
    <div ref={cesiumContainerRef} className={className} />
  );
};

export default CesiumComponent;