export const Cesium = require('cesium/Cesium');

require('cesium/Widgets/widgets.css');

const requireAll = r => r.keys().forEach(r);
requireAll(require.context('./', true, /\.(scss|css)$/));

import * as config from './config';
import { updateLayerStyle, getChemicalLayerName } from './functions/layer-style-update.js'

Cesium.Ion.defaultAccessToken = undefined;

//const ellipsoid = new Cesium.Ellipsoid(1737400, 1737400, 1737400);
const ellipsoid = new Cesium.Ellipsoid(6378137.0, 6378137.0, 6356752.3142);

Cesium.Ellipsoid.WGS84 = ellipsoid;
const mapProjection = new Cesium.GeographicProjection(ellipsoid);

const globe = new Cesium.Globe(ellipsoid);

globe.showGroundAtmosphere = false;

export const viewer = new Cesium.Viewer('cesiumContainer', {
  globe: globe,
  mapProjection: mapProjection,
  baseLayer: new Cesium.ImageryLayer (new Cesium.WebMapServiceImageryProvider({
    url: `${config.mapServerWmsUrl}`,
    layers: 'lunar-resources:WAC_GLOBAL_100M',
    parameters: {
      transparent: false,
      format: 'image/png'
    },
    // Max 4096
    tileWidth: 512,
    tileHeight: 512
  })),
  timeline: false,
  animation: false,
  baseLayerPicker: false,
  infoBox: false,
  selectionIndicator: false,
});

viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

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

const geologicLayerNames = ['GeoUnits', 'GeoContacts'];

let geologicLayerName;

/*
    Nomenclature
*/

/* let nomenclatureLayer = viewer.imageryLayers.addImageryProvider(
  new Cesium.WebMapServiceImageryProvider({
    url: 'http://localhost:8090/geoserver/lunar-resources/wms',
    layers: 'lunar-resources:Nomenclature',
    parameters: {
      transparent: true,
      format: 'image/png'
    }
  })
);
 */

let nomenclatureLayer;

fetch('http://localhost:8090/geoserver/lunar-resources/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=lunar-resources:Nomenclature&outputFormat=application%2Fjson')
  .then(response => response.json())
  .then(data=> {
    let dataSourcePromise = Cesium.GeoJsonDataSource.load(data, {
      clampToGround: false
    });
    dataSourcePromise.then(dataSource => {
      let entities = dataSource.entities.values;
      for (let i = 0; i < entities.length; i++) {
        let entity = entities[i];
        entity.billboard = undefined;
        let position = entity.position._value;
        position = Cesium.Cartesian3.fromElements(position.x, position.y, position.z + 5000);
        entity.position = position;
        entity.label = new Cesium.LabelGraphics({
          text: entity.properties.name,
          // When lunar MNT is implemented, change to RELATIVE_TO_GROUND
          heightReference: Cesium.HeightReference.NONE,
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          scale: 0.6,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2500000),
          //pixelOffset: new Cesium.Cartesian2(-10, -10),
          //eyeOffset: new Cesium.Cartesian3(0, 0, -20)
        });
      }
      viewer.dataSources.add(dataSource);
      nomenclatureLayer = dataSource;
      nomenclatureLayer.show = false;
    });
  });

const nomenclatureCheckbox = document.getElementById('nomenclature-checkbox');

nomenclatureCheckbox.addEventListener('change', function() {
  nomenclatureLayer.show = nomenclatureCheckbox.checked;
});

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
    optionContainer.style.display = "flex";

    let transparencyContainer = document.getElementById("transparency-container-geo-btn");
    transparencyContainer.style.display = "flex";

    document.getElementById('transparency-geo-btn-value').textContent = '25%'
  
    geologicLayerNames.forEach(function(layerName) {
      const layer = viewer.imageryLayers.addImageryProvider(
        new Cesium.WebMapServiceImageryProvider({
          url: `${config.mapServerWmsUrl}`,
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
      getChemicalLayerName()
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

import { drawPolyline } from './functions/selection/polyline';

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
    Map selection
*/

export const htmlChemicalLayerNames = config.chemicalLayerNames.map(name => {
  const data = config.chemicalLayerData[name];
  return `
      <button id="${name}" class="layer-btn">
      <div class="name">${data ? data.name : name}</div>
      <div class="number">${data ? data.number : ''}</div>
      <div class="symbol">${data ? data.symbol : ''}</div>
      <div class="info-icon material-symbols-outlined">info</div>
      </button>`;
}).join('');

document.getElementById('btn-group').innerHTML = htmlChemicalLayerNames;

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
    Periodic table opener
*/

const overlay = document.getElementById("periodic-table-overlay");
const elementsTabContent = document.getElementById("elements");

function showPeriodicTableOverlay() {
  overlay.style.display = "block";
  overlay.style.visibility = "visible";
  overlay.classList.add("open");
}

function hidePeriodicTableOverlay() {
  overlay.style.display = "none";
  overlay.style.visibility = "hidden";
  overlay.classList.remove("open");
}

document.getElementById('selected-element-container').addEventListener('click', function() {
  showPeriodicTableOverlay();
  elementsTabContent.style.display = "none";
});

overlay.addEventListener('click', function() {
  hidePeriodicTableOverlay();
  elementsTabContent.style.display = "flex";
})

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
    Opacity slider
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
    WMS Pixel call
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
    url: `${config.mapServerWmsUrl}`,
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
*/
function openTabs(evt, tabName) {
  let i, tabcontent, tablinks;

  let currentTabContent = document.getElementById(tabName);

  if (currentTabContent.style.display === "flex") {
    currentTabContent.style.display = "none";
    evt.currentTarget.className = evt.currentTarget.className.replace(" active", "");
  } else {
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
      tabcontent[i].style.display = "none";
    }

    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
      tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    document.getElementById(tabName).style.display = "flex";
    evt.currentTarget.className += " active";
  }

  const overlay = document.getElementById("periodic-table-overlay");
    hidePeriodicTableOverlay();
}

// Use the DOMContentLoaded event to ensure the DOM is fully loaded before trying to attach event listeners
document.addEventListener('DOMContentLoaded', (event) => {
  const tablinks = document.getElementsByClassName("tablinks");
  for (let i = 0; i < tablinks.length; i++) {
    tablinks[i].addEventListener("click", function(event) {
      openTabs(event, tablinks[i].dataset.tabname);
    });
  }

  const tabcontents = document.getElementsByClassName("tabcontent");
  for (let i = 0; i < tabcontents.length; i++) {
    if (tabcontents[i].id !== 'home') {
      tabcontents[i].style.display = "none";
    }
  }

  document.querySelector('button[data-tabname="home"]').click();
});