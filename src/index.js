const Cesium = require('cesium/Cesium');
require('./css/main.scss');
require('./css/opacity.scss');
require('./css/switch.scss');
require('./css/legend.scss');
require('./css/left-sidebar.scss');
require('./css/right-sidebar.scss')
require('cesium/Widgets/widgets.css');

import colorRamp from './image/color-ramp.png';
import grayRamp from './image/gray-ramp.png';

Cesium.Ion.defaultAccessToken = undefined;

//const ellipsoid = new Cesium.Ellipsoid(1737400, 1737400, 1737400);
const ellipsoid = new Cesium.Ellipsoid(6378137.0, 6378137.0, 6356752.3142);

Cesium.Ellipsoid.WGS84 = ellipsoid;
const mapProjection = new Cesium.GeographicProjection(ellipsoid);

const globe = new Cesium.Globe(ellipsoid);

globe.showGroundAtmosphere = false;

const viewer = new Cesium.Viewer('cesiumContainer', {
  globe: globe,
  mapProjection: mapProjection,
  imageryProvider: new Cesium.WebMapServiceImageryProvider({
    url: 'https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/earth/moon_simp_cyl.map&service=WMS',
    layers: 'LROC_WAC',
    parameters: {
      transparent: false,
      format: 'image/png'
    },
    // Max 4096
    tileWidth: 512,
    tileHeight: 512
  }),
  timeline: false,
  animation: false,
  baseLayerPicker: false,
});

const scene = viewer.scene;
if (!scene.pickPositionSupported) {
  window.alert("This browser does not support picking position.");
};

scene.fog.enabled = false;
viewer.scene.enableLighting = false;
scene.moon.show = false;
scene.sun.show = false;
viewer.scene.skyAtmosphere.show = false;
viewer.scene.shadowMap.enabled = false;

viewer._cesiumWidget._creditContainer.parentNode.removeChild(viewer._cesiumWidget._creditContainer);


/*
================
SECONDARY LAYERS
================
*/

/*
  Geologic layer button selection
*/

import geoButton from './image/geologic-button-background.jpg'

let style = document.createElement('style');
style.innerHTML = `
  .geo-btn {
    background-image: url('${geoButton}');
  }
`;
document.head.appendChild(style);

let geologicLayers = [];

document.getElementById("geo-button").addEventListener('click', function () {

  if (geologicLayers.length === 0) {

    let optionContainer = document.getElementById("geo-button-option-container");
    optionContainer.classList.add('unfold-animation');
    optionContainer.style.display = "block";

    let transparencyContainer = document.getElementById("transparency-container");
    transparencyContainer.style.display = "block";

    const geologicLayerNames = [
      'GeoUnits',
      'GeoContacts',
      'Linear_Features',
      'Labels_Global'
    ];
    
    geologicLayerNames.forEach(function(layerName) {
      const layer = viewer.imageryLayers.addImageryProvider(
        new Cesium.WebMapServiceImageryProvider({
          url: 'http://localhost:8090/geoserver/lunar-resources/wms',
          layers: 'lunar-resources:' + layerName,
          parameters: {
            transparent: true,
            format: 'image/png'
          }
        })
      );
      geologicLayers.push(layer);
    });
  }
});

document.getElementById("transparency").addEventListener('input', function() {
  const transparency = this.value;
  geologicLayers.forEach(function(layer) {
    layer.alpha = transparency;
  });
});

document.getElementById("deselect-secondary-layer-button").addEventListener('click', function() {
  geologicLayers.forEach(function(layer) {
    viewer.imageryLayers.remove(layer);
  });
  geologicLayers = [];

  let optionContainer = document.getElementById("geo-button-option-container");
  optionContainer.style.display = "none";

  let transparencyContainer = document.getElementById("transparency-container");
  transparencyContainer.style.display = "none";

})

import defaultLayerBackground from "./image/default-layer-background.jpg"

let styleNoneButton = document.createElement('style');
styleNoneButton.innerHTML = `
  #deselect-secondary-layer-button {
    background-image: url('${defaultLayerBackground}');
  }
`;
document.head.appendChild(styleNoneButton);

/*
===========================
*/

/*
    Mouse
*/

let handler;

const entity = viewer.entities.add({
  label: {
    show: false,
    showBackground: true,
    font: "14px monospace",
    horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    pixelOffset: new Cesium.Cartesian2(15, 0),
  },
});

const coordsDiv = document.getElementById('coords');

const mouseCheckbox = document.getElementById('mouse-data-checkbox');
handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
scene.canvas.setAttribute('willReadFrequently', 'true');

handler.setInputAction(async function (movement) {
  const cartesian = viewer.camera.pickEllipsoid(movement.endPosition, scene.globe.ellipsoid);
  if (cartesian) {
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    const longitudeString = Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);
    const latitudeString = Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);

    const longSign = Number(longitudeString) > 0 ? ' ' : '';
    const latSign = Number(latitudeString) > 0 ? ' ' : '';

    coordsDiv.innerText =
    `Latitude: ${`${latSign}${latitudeString}`.slice(-11)}\u00B0`+
    `, Longitude: ${`${longSign}${longitudeString}`.slice(-11)}\u00B0`;

    entity.position = cartesian;
    entity.label.show = mouseCheckbox.checked;

    const pixelValuePromise = getFeatureInfo(parseFloat(longitudeString), parseFloat(latitudeString));

    pixelValuePromise.then((pixelValue) => {

      if (mouseCheckbox.checked) {
        if (pixelValue !== null) {
          entity.label.text = `${pixelValue.toFixed(2)} wt.%`;
        } else {
          entity.label.text = `N/A`;
        }
      }
    });
  } else {
    coordsDiv.innerText = '';
  }
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

/*
    MinMax value definition
*/
const layerMinMaxValues = {
  'MAGNESIUM': {min: 2.08, max: 9.60},
  'IRON': {min: 2.69, max: 27.53},
  'CALCIUM': {min: 7.12, max: 13.38},
  'TITANIUM': {min: 0.08, max: 18.45},
};

/*
    Map selection
*/

const layerNames = ['MAGNESIUM', 'IRON', 'CALCIUM', 'TITANIUM'];

const layerData = {
  'MAGNESIUM': {name: 'Magnesium', number: '12', symbol: 'Mg'},
  'IRON': {name: 'Iron', number: '26', symbol: 'Fe'},
  'CALCIUM': {name: 'Calcium', number: '20', symbol: 'Ca'},
  'TITANIUM': {name: 'Titanium', number: '22', symbol: 'Ti'},
};

const html = layerNames.map(name => {
  const data = layerData[name];
  return `
    <button id="${name}" class="layer-btn">
      <div class="name">${data ? data.name : name}</div>
      <div class="number">${data ? data.number : ''}</div>
      <div class="symbol">${data ? data.symbol : ''}</div>
      <div class="info-icon material-symbols-outlined">info</div>
    </button>`;
}).join('');

let selectedValue;

document.getElementById('btn-group').innerHTML = html;

const layerButtons = document.querySelectorAll('.layer-btn');

layerButtons.forEach(button => {
  button.addEventListener('click', function() {
    if(this.classList.contains('selected')) {
      return;
    }
    layerButtons.forEach(btn => {
      btn.classList.remove('selected');
    });
    this.classList.add('selected');
    updateLayerStyle();
  });
});

/*
    Deselect button
*/

const deselectBtn = document.getElementById('basemap');
deselectBtn.addEventListener('click', function() {
  layerButtons.forEach(btn => {
    btn.classList.remove('selected');
  });
  updateLayerStyle();
});

deselectBtn.click();

/*
    Layer color switch
*/

const toggleColorSwitch = document.getElementById('toggle-color-switch');
let isColorStyle = false;

toggleColorSwitch.addEventListener('change', function() {
  isColorStyle = !isColorStyle;
  updateLayerStyle();
});

/*
    Update layer function
*/

const mapServerWmsUrl = 'http://localhost:8090/geoserver/lunar-resources/wms';

let activeLayer;

function updateLayerStyle() {

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
        url: mapServerWmsUrl,
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

  } else {
    minValueLabel.textContent = '';
    maxValueLabel.textContent = '';
  }

  slider.value = 0;
  info.textContent = '0%';

}

/*
    opacity slider
*/

const slider = document.getElementById('opacity-slider');
const info = document.getElementById('opacity-info');

slider.addEventListener('input', function() {
  if (activeLayer) {
    activeLayer.alpha = 1 - slider.value / 100;
  }
  info.textContent = slider.value + '%';
})


/*
    Fonction d'appel d'information de pixel du serveur WMS
*/

async function getFeatureInfo(longitude, latitude) {
  const url = new Cesium.Resource({
    url: mapServerWmsUrl,
    queryParameters: {
      service: "WMS",
      version: "1.1.1",
      request: "GetFeatureInfo",
      layers: 'lunar-resources:'+selectedValue,
      styles: "",
      srs: "EPSG:4326",
      format: "image/png",
      bbox: `${longitude - 0.1},${latitude - 0.1},${longitude + 0.1},${latitude + 0.1}`,
      width: 2,
      height: 2,
      query_layers: 'lunar-resources:'+selectedValue,
      info_format: "text/plain",
      x: 1,
      y: 1,
    },
  });

  try {
    const responseText = await url.fetch();
    const match = responseText.match(/VALUE = (\d+\.\d+|NaN)/);
    if (match && match[1]) {
      const pixelValue = parseFloat(match[1]);
      if (isNaN(pixelValue)) {
        return null;
      }
      return pixelValue;
    } else {
      // Missing pixel info detection (eg. other map under)
      return null;
    }
  } catch (error) {
    console.error("Error fetching GetFeatureInfo:", error);
    return null;
  }
}

/*
  Graph template
*/

import graphTemplate from "./image/graph-template.jpg"

let styleGraphTemplate = document.createElement('style');
styleGraphTemplate.innerHTML = `
  #graph-template-container {
    background-image: url('${graphTemplate}');
    background-size: cover;
    background-position: center;
    position: absolute;
    bottom: 0;
    width: calc(100% - 10px);
    height: calc(200px - 10px);=
    margin: 5px;
    opacity: 0.5;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  }
`;
document.head.appendChild(styleGraphTemplate);


