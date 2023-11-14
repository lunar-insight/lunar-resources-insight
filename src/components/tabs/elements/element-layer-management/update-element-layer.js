/*
  Update element layer
*/

const Cesium = require('cesium/Cesium');
import { viewer } from 'index';
import { mapServerWorkspaceName, mapServerWmsUrl } from 'config';

let activeLayer;

export function updateElementLayer(elementName) {
  
  if (activeLayer) {
    viewer.imageryLayers.remove(activeLayer);
  }

  const selectedValue = elementName.toUpperCase();
  const styleSuffix = 'COLOR'; // OR 'GRAY todo change'
  const styleName = `STYLE_${styleSuffix}_GLOBAL20PPD_${selectedValue}`;

  activeLayer = viewer.imageryLayers.addImageryProvider(
    new Cesium.WebMapServiceImageryProvider({
      url: `${mapServerWmsUrl}`,
      layers: `${mapServerWorkspaceName}:` + selectedValue,
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