/*
  Update element layer
*/

const Cesium = require('cesium/Cesium');
import { viewer } from 'index';
import { mapServerWorkspaceName, mapServerWmsUrl, layersConfig } from 'config';

let activeLayer;
let activeLayerName;

export function updateElementLayer(elementName, sldString, minValue, maxValue) {
  
  if (activeLayer) {
    viewer.imageryLayers.remove(activeLayer);
  }

  const elementLayerConfig = getLayerConfigForElement(elementName); // Use the config.js file to map the correct chemical element layer name
  if (!elementLayerConfig) { 
    console.error('No layer configuration found for element:', elementName);
    return;
  }

  const layerMapName = elementLayerConfig.mapName;
  activeLayerName = layerMapName;

  /* TODO:
      Constructing the 'env' parameter for CQL expressions,
      only if 'min' and 'max' values parameters are provided to the function,
      This is used for dynamic style update from the WMS request.
      (Unrelated to the .ENV file)
  */
  let envParams = '';
  if (minValue !== undefined && maxValue !== undefined) {
    envParams = `&ENV=minValue:${minValue};maxValue:${maxValue}`;
  } else {
    envParams = 'minValue:0;maxValue:100';
  }

/*   // Construct the request URL manually for testing purpose:
  const requestUrl = `${mapServerWmsUrl}?` +
  `service=WMS&` +
  `request=GetMap&` +
  `layers=${encodeURIComponent(`${mapServerWorkspaceName}:${layerMapName}`)}&` +
  `transparent=${encodeURIComponent('true')}&` +
  `format=${encodeURIComponent('image/png')}&` +
  `SLD_BODY=${encodeURIComponent(sldString)}&` +
  `ENV=${encodeURIComponent(envParams)}`;

  // Log the request URL
  console.log("Request URL:", requestUrl); */

  activeLayer = viewer.imageryLayers.addImageryProvider(
    new Cesium.WebMapServiceImageryProvider({
      url: `${mapServerWmsUrl}`,
      layers: `${mapServerWorkspaceName}:` + layerMapName,
      parameters: {
        transparent: true,
        format: 'image/png',
        SLD_BODY: sldString,
        //ENV: envParams
      }
    })
  );
}

export function getActiveLayer() {
  return activeLayer;
}

export function getActiveLayerName() {
  return activeLayerName;
}

export function removeActiveLayer() {
  activeLayer = null;
  activeLayerName = null;
}

// This function take into account the map name and link the config.js file
function getLayerConfigForElement(elementName) {
  const configKey = `${elementName.toLowerCase()}Layer`;
  return layersConfig[configKey];
}