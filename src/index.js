const Cesium = require('cesium/Cesium');
require('./css/main.scss');
require('./css/opacity.scss');
require('./css/switch.scss');
require('./css/legend.scss');
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

const mouseCheckbox = document.createElement('input');
mouseCheckbox.type = "checkbox";
mouseCheckbox.checked = true;
mouseCheckbox.id = "mouseDataCheckbox";
mouseCheckbox.className = "mouseDataQueryCheckbox";

const label = document.createElement('label');
label.htmlFor = "mouseDataCheckbox";
label.className = "labelMouseDataQueryCheckbox"
label.appendChild(document.createTextNode('Cursor Data Query'));

const toolbar = document.getElementsByClassName('cesium-viewer-toolbar')[0];
toolbar.appendChild(mouseCheckbox);
toolbar.appendChild(label);

handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
scene.canvas.setAttribute('willReadFrequently', 'true');

handler.setInputAction(async function (movement) {
  const cartesian = viewer.camera.pickEllipsoid(movement.endPosition, scene.globe.ellipsoid);
  if (cartesian && mouseCheckbox.checked) {
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    const longitudeString = Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);
    const latitudeString = Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);

    const longSign = Number(longitudeString) > 0 ? ' ' : '';
    const latSign = Number(latitudeString) > 0 ? ' ' : '';

    entity.position = cartesian;
    entity.label.show = true;

    const pixelValue = await getFeatureInfo(
      parseFloat(longitudeString),
      parseFloat(latitudeString)
    );

    if (pixelValue !== null) {
      entity.label.text =
        `Lon: ${`${longSign}${longitudeString}`.slice(-11)}\u00B0` +
        `\nLat: ${`${latSign}${latitudeString}`.slice(-11)}\u00B0` +
        `\nValue: ${pixelValue.toFixed(2)} wt.%`;
    } else {
      entity.label.text =
        `Lon: ${`${longSign}${longitudeString}`.slice(-11)}\u00B0` +
        `\nLat: ${`${latSign}${latitudeString}`.slice(-11)}\u00B0` +
        `\nValue: N/A`;
    }
  } else {
    entity.label.show = false;
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

const layersList = document.getElementById('layersSelect');

const option0 = document.createElement('option');
option0.text = 'Basemap';
option0.value = 'BASEMAP';
layersList.add(option0);

const option1 = document.createElement('option');
option1.text = 'Magnesium';
option1.value = 'MAGNESIUM';
layersList.add(option1);

const option2 = document.createElement('option');
option2.text = 'Iron';
option2.value = 'IRON';
layersList.add(option2);

const option3 = document.createElement('option');
option3.text = 'Calcium';
option3.value = 'CALCIUM';
layersList.add(option3);

const option4 = document.createElement('option');
option4.text = 'Titanium';
option4.value = 'TITANIUM';
layersList.add(option4);

layersList.selectedIndex = 0;

const mapServerWmsUrl = 'http://localhost:8090/geoserver/lunar-resources/wms';

let activeLayer;

layersList.addEventListener('change', function() {
  updateLayerStyle();
});

const toggleColorSwitch = document.getElementById('toggleColorSwitch');
let isColorStyle = false;

toggleColorSwitch.addEventListener('change', function() {
  isColorStyle = !isColorStyle;
  updateLayerStyle();
});

function updateLayerStyle() {

  const styleSuffix = isColorStyle ? 'COLOR' : 'GRAY';

  const legendContainer = document.getElementById('legend-container');
  const legentTitle = document.getElementById('legend-title');

  if (activeLayer) {
    viewer.imageryLayers.remove(activeLayer);
  }

  const legendImage = document.getElementById('legend-image');
  const minValueLabel = document.getElementById('min-value-label');
  const maxValueLabel = document.getElementById('max-value-label');

  if (layersList.value !== 'BASEMAP') {
    const styleName = `STYLE_${styleSuffix}_GLOBAL20PPD_${layersList.value}`;

    activeLayer = viewer.imageryLayers.addImageryProvider(
      new Cesium.WebMapServiceImageryProvider({
        url: mapServerWmsUrl,
        layers: 'lunar-resources:' + layersList.value,
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

    const layerValues = layerMinMaxValues[layersList.value];
    if (layerValues) {
      minValueLabel.textContent = layerValues.min;
      maxValueLabel.textContent = layerValues.max;
    }

  } else {
    minValueLabel.textContent = '';
    maxValueLabel.textContent = '';
  }

  slider.value = 100;
  info.textContent = '100%';

}

/*
    opacity slider
*/

const slider = document.getElementById('opacity-slider');
const info = document.getElementById('opacity-info');

slider.addEventListener('input', function() {
  if (activeLayer) {
    activeLayer.alpha = slider.value / 100;
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
      layers: 'lunar-resources:'+layersList.value,
      styles: "",
      srs: "EPSG:4326",
      format: "image/png",
      bbox: `${longitude - 0.1},${latitude - 0.1},${longitude + 0.1},${latitude + 0.1}`,
      width: 2,
      height: 2,
      query_layers: 'lunar-resources:'+layersList.value,
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

