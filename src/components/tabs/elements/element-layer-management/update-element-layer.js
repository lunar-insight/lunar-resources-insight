/*
  Update element layer
*/

const Cesium = require('cesium/Cesium');
import { viewer } from 'index';
import { mapServerWmsUrl } from 'config';

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
      layers: 'lunar-resources:' + selectedValue,
      parameters: {
        transparent: true,
        format: 'image/png',
        styles: styleName
      }
    })
  );

}