const Cesium = require('cesium/Cesium');

require('cesium/Widgets/widgets.css');

const requireAll = r => r.keys().forEach(r);
requireAll(require.context('./css/', true, /\.(scss|css)$/));

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
  infoBox: false,
  selectionIndicator: false,
});

viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
/* var handlerLeftDoubleClick = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
handlerLeftDoubleClick.setInputAction(function(movement) {
  viewer.trackedEntity = undefined;
}, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK) */

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

const chemicalLayerNames = ['MAGNESIUM', 'IRON', 'CALCIUM', 'TITANIUM'];

const geologicLayerNames = ['GeoUnits', 'GeoContacts'];

let geologicLayerName;
let chemicalLayerName;

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

    let transparencyContainer = document.getElementById("transparency-container-geo-btn");
    transparencyContainer.style.display = "block";

    document.getElementById('transparency-geo-btn-value').textContent = '25%'
  
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
      layer.alpha = 0.25;
      geologicLayers.push(layer);
    });

    geologicLayerName = 'GeoUnits';

    document.getElementById("transparency-geo-btn").value = 25;
  }
});

document.getElementById("transparency-geo-btn").addEventListener('input', function() {
  const transparency = this.value;
  geologicLayers.forEach(function(layer) {
    layer.alpha = transparency / 100;
  });

  document.getElementById('transparency-geo-btn-value').textContent = transparency + '%';
});

document.getElementById("deselect-secondary-layer-button").addEventListener('click', function() {
  geologicLayers.forEach(function(layer) {
    viewer.imageryLayers.remove(layer);
  });
  geologicLayers = [];

  geologicLayerName = null;

  let optionContainer = document.getElementById("geo-button-option-container");
  optionContainer.style.display = "none";

  let transparencyContainer = document.getElementById("transparency-container-geo-btn");
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
    Throttling
*/

let isRequestInProgress = false;
let lastInfo = null;

async function getFeatureInfoThrottled(longitude, latitude, geologicLayer, chemicalLayer) {
  if (isRequestInProgress) {
    return lastInfo;
  }

  isRequestInProgress = true;

  lastInfo = await getFeatureInfo(longitude, latitude, geologicLayer, chemicalLayer);

  await new Promise(resolve => setTimeout(resolve, 25));

  isRequestInProgress = false;

  return lastInfo;
}

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

let mouseOverGlobe = false;

mouseCheckbox.addEventListener('change', function() {
  entity.label.show = this.checked && mouseOverGlobe;
});


handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
scene.canvas.setAttribute('willReadFrequently', 'true');

handler.setInputAction(async function (movement) {
  const cartesian = viewer.camera.pickEllipsoid(movement.endPosition, scene.globe.ellipsoid);
  if (cartesian) {
    mouseOverGlobe = true;

    const {longitudeString, latitudeString} = convertCoordinatesToFixed(cartesian);

    const longSign = Number(longitudeString) > 0 ? ' ' : '';
    const latSign = Number(latitudeString) > 0 ? ' ' : '';

    coordsDiv.innerText =
    `Latitude: ${`${latSign}${latitudeString}`.slice(-11)}\u00B0`+
    `, Longitude: ${`${longSign}${longitudeString}`.slice(-11)}\u00B0`;

    entity.position = cartesian;
    entity.label.show = mouseCheckbox.checked;

    const featureInfoPromise = getFeatureInfoThrottled(
      parseFloat(longitudeString),
      parseFloat(latitudeString),
      geologicLayerName,
      chemicalLayerName
    );

    featureInfoPromise.then((info) => {
      
      if (mouseCheckbox.checked) {
        if (info != null) {
          
          let labelText = '';

          if (info.hasOwnProperty('chemical')) {
            labelText += `${info.chemical.toFixed(2)} wt.%`;
          }

          if (info.hasOwnProperty('geologic')) {
            if (labelText !== '') {
              labelText += '\n';
            }
            labelText += `${info.geologic.firstUn1} (${info.geologic.firstUnit})`;
          }

          if (labelText === '') {
            labelText = 'No data';
          }

          entity.label.text = labelText;

        } else {
          entity.label.text = 'No Data';
        }
      }
    });

  } else {
    coordsDiv.innerText = '';
    entity.label.show = false;
    mouseOverGlobe = false;
  }
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

/*
    Convert Coordinate
*/

function convertCoordinates(cartesian) {
  const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
  const longitudeString = Cesium.Math.toDegrees(cartographic.longitude);
  const latitudeString = Cesium.Math.toDegrees(cartographic.latitude);

  return {longitudeString, latitudeString};
}

function convertCoordinatesToFixed(cartesian) {
  const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
  const longitudeString = Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);
  const latitudeString = Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);

  return {longitudeString, latitudeString};
}

/*
  Selection menu
*/

import { drawPolyline } from './menu/selection/polyline';

const polylineButton = document.getElementById('polyline-button');
let isPolylineDrawing = false;

polylineButton.addEventListener('click', function() {
  isPolylineDrawing = drawPolyline(Cesium, viewer, handler, isPolylineDrawing);

  if (isPolylineDrawing) {
    polylineButton.classList.add('selected');
  } else {
    polylineButton.classList.remove('selected');
  }
});

window.addEventListener('polylineDrawn', function() {
  polylineButton.classList.remove('selected');
  isPolylineDrawing = false;
})


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

const layerData = {
  'MAGNESIUM': {name: 'Magnesium', number: '12', symbol: 'Mg'},
  'IRON': {name: 'Iron', number: '26', symbol: 'Fe'},
  'CALCIUM': {name: 'Calcium', number: '20', symbol: 'Ca'},
  'TITANIUM': {name: 'Titanium', number: '22', symbol: 'Ti'},
};

const html = chemicalLayerNames.map(name => {
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

async function getFeatureInfo(longitude, latitude, geologicLayer = null, chemicalLayer = null) {

  let results = {};

  if (geologicLayer) {
    const geologicInfo = await getLayerInfo(longitude, latitude, geologicLayer);
    if (geologicInfo) {
      results.geologic = geologicInfo;
    }
  }

  if (chemicalLayer) {
    const chemicalInfo = await getLayerInfo(longitude, latitude, chemicalLayer);
    if (chemicalInfo) {
      results.chemical = chemicalInfo;
    }
  }

  if (Object.keys(results).length > 0) {
    return results;
  } else {
    return null;
  }
}

async function getLayerInfo(longitude, latitude, layerName) {
  const url = new Cesium.Resource({
    url: mapServerWmsUrl,
    queryParameters: {
      service: "WMS",
      version: "1.1.1",
      request: "GetFeatureInfo",
      layers: 'lunar-resources:' + layerName,
      styles: "",
      srs: "EPSG:4326",
      format: "image/png",
      bbox: `${longitude - 0.000001},${latitude - 0.000001},${longitude + 0.000001},${latitude + 0.000001}`,
      width: 2,
      height: 2,
      query_layers: 'lunar-resources:' + layerName,
      info_format: "application/json",
      x: 1,
      y: 1,
    },
  });

  try {
    const responseText = await url.fetch();
    const responseJson = JSON.parse(responseText);

    if (responseJson.features && responseJson.features.length > 0) {
      const feature = responseJson.features[0];

      // Geologic data processing
      if (feature.properties.FIRST_Un_1 && feature.properties.FIRST_Unit) {
        const firstUn1 = feature.properties.FIRST_Un_1;
        const firstUnit = feature.properties.FIRST_Unit;
        return {firstUn1, firstUnit};
      }

      // Chemical data processing
      if (!isNaN(parseFloat(feature.properties.VALUE))) {
        const pixelValue = parseFloat(feature.properties.VALUE);
        return pixelValue;
      }
    }

    return null;
  } catch (error) {
    console.error("Error fetching GetFeatureInfo:", error);
    return null;
  }
};

/*
  Tabs

  TODO : see to optimise the code
*/
function openTabs(evt, tabName) {
  // Declare all variables
  let i, tabcontent, tablinks;

  // Get the element with the id=tabName
  let currentTabContent = document.getElementById(tabName);

  // Check if the current tabcontent is already displayed
  if (currentTabContent.style.display === "block") {
    // If yes, hide it
    currentTabContent.style.display = "none";
    evt.currentTarget.className = evt.currentTarget.className.replace(" active", "");
  } else {
    // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
      tabcontent[i].style.display = "none";
    }

    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
      tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // Show the current tab, and add an "active" class to the link that opened the tab
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
  }
}

// Use the DOMContentLoaded event to ensure the DOM is fully loaded before trying to attach event listeners
document.addEventListener('DOMContentLoaded', (event) => {
  const tablinks = document.getElementsByClassName("tablinks");
  for (let i = 0; i < tablinks.length; i++) {
    tablinks[i].addEventListener("click", function(event) {
      openTabs(event, tablinks[i].dataset.tabname);
    });
  }

  // Hide all tabcontents except 'home'
  const tabcontents = document.getElementsByClassName("tabcontent");
  for (let i = 0; i < tabcontents.length; i++) {
    if (tabcontents[i].id !== 'home') {
      tabcontents[i].style.display = "none";
    }
  }

  // Trigger a click on 'home' button to make it active by default
  document.querySelector('button[data-tabname="home"]').click();
});