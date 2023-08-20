import colorRamp from '../image/color-ramp.png';
import grayRamp from '../image/gray-ramp.png';

import { Cesium, viewer } from '../index.js';
import { mapServerWmsUrl, layerMinMaxValues } from '../config.js';

const toggleColorSwitch = document.getElementById('toggle-color-switch');
let isColorStyle = false;

toggleColorSwitch.addEventListener('change', function() {
  isColorStyle = !isColorStyle;
  updateLayerStyle();
});

let selectedValue;
let activeLayer;
let chemicalLayerName;

const slider = document.getElementById('opacity-slider');
const info = document.getElementById('opacity-info');

export function updateLayerStyle() {

  const styleSuffix = isColorStyle ? 'COLOR' : 'GRAY';

  const legendContainer = document.getElementById('legend-container');
  const legendTitle = document.getElementById('legend-title');

  if (activeLayer) {
    viewer.imageryLayers.remove(activeLayer);
  }

  const legendImage = document.getElementById('legend-image');
  const minValueLabel = document.getElementById('min-value-label');
  const maxValueLabel = document.getElementById('max-value-label');

  const selectedElement = document.querySelector('.selected');
  selectedValue = selectedElement ? selectedElement.id : null;

  if (selectedValue && selectedValue !== 'BASEMAP') {

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

    if (styleSuffix === 'COLOR') {
      legendImage.src = colorRamp;
    } else if (styleSuffix === 'GRAY') {
      legendImage.src = grayRamp;
    }

    const layerValues = layerMinMaxValues[selectedValue];
    if (layerValues) {
      minValueLabel.textContent = layerValues.min;
      maxValueLabel.textContent = layerValues.max;
    }

    chemicalLayerName = selectedValue;

    legendContainer.classList.add('active');

  } else {
    minValueLabel.textContent = '';
    maxValueLabel.textContent = '';

    chemicalLayerName = null;

    legendContainer.classList.remove('active');
  }

  slider.value = 100;
  info.textContent = '100%';

}

export function getChemicalLayerName() {
  return chemicalLayerName;
}