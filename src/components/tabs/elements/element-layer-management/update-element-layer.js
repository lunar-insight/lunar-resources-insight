/*
  Update element layer
*/

const Cesium = require('cesium/Cesium');
import { viewer } from 'index';
import { mapServerWorkspaceName, mapServerWmsUrl, layersConfig } from 'config';

let activeLayer;

export function updateElementLayer(elementName) {
  
  if (activeLayer) {
    viewer.imageryLayers.remove(activeLayer);
  }

  //const selectedValue = elementName.toUpperCase();

  const elementLayerConfig = getLayerConfigForElement(elementName); // Use the config.js file to map the correct chemical element layer name
  if (!elementLayerConfig) { 
    console.error('No layer configuration found for element:', elementName);
    return;
  }

  const layerMapName = elementLayerConfig.mapName;

  const styleSuffix = 'COLOR'; // OR 'GRAY todo change'
  const styleName = `STYLE_${styleSuffix}_GLOBAL20PPD_${layerMapName.toUpperCase()}`; // Temporary before creating the dynamic SLD

  activeLayer = viewer.imageryLayers.addImageryProvider(
    new Cesium.WebMapServiceImageryProvider({
      url: `${mapServerWmsUrl}`,
      layers: `${mapServerWorkspaceName}:` + layerMapName,
      parameters: {
        transparent: true,
        format: 'image/png',
        styles: styleName
      }
    })
  );
}

export function getActiveLayer() {
  return activeLayer
}

export function removeActiveLayer() {
  activeLayer = null;
}

// This function take into account the map name and link the config.js file
function getLayerConfigForElement(elementName) {
  const configKey = `${elementName.toLowerCase()}Layer`;
  return layersConfig[configKey];
}