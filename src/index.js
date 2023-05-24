// TODO : Retirer le async pour la sélection
// TODO : Transparence du raster
// TODO : CSS personnalisé sur le thème de Offworld Horizon
// https://sandcastle.cesium.com/index.html?src=Imagery%20Layers%20Manipulation.html
// https://jsfiddle.net/q2vo8nge/
// https://www.freecodecamp.org/french/news/balise-html-select-comment-creer-un-menu-deroulant-ou-une-liste-deroulante/
// https://sandcastle.cesium.com/?src=3D%20Tiles%20Next%20S2%20Globe.html
// https://github.com/CesiumGS/cesium/issues/7953
// https://sandcastle.cesium.com/?src=Picking.html


const Cesium = require('cesium/Cesium');
require('./css/main.css');
require('cesium/Widgets/widgets.css');

Cesium.Ion.defaultAccessToken = process.env.CESIUM_ION_ACCESS_TOKEN;

// Define a default blank imageryProvider
const viewer = new Cesium.Viewer('cesiumContainer', {
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
});

const scene = viewer.scene;
if (!scene.pickPositionSupported) {
  window.alert("This browser does not support picking position.");
};

scene.fog.enabled = false;
// Voir pourquoi on vois toujours l'atmosphère
scene.globe.showGroundAtmosphere = false;
//viewer.scene.enableLighting = false;
scene.moon.show = false;
scene.sun.show = false;
//viewer.scene.shadowMap.enabled = false;



let handler;

/*
    Mouse
*/

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

layersList.addEventListener('change', function() {

  switch (layersList.value) {

    case 'BASEMAP':
      if (viewer.imageryLayers.length > 1) { viewer.imageryLayers.remove(viewer.imageryLayers.get(1)) };
      break;

    case 'MAGNESIUM':
      if (viewer.imageryLayers.length > 1) { viewer.imageryLayers.remove(viewer.imageryLayers.get(1)) };
      viewer.imageryLayers.addImageryProvider(
        new Cesium.WebMapServiceImageryProvider({
          url: mapServerWmsUrl,
          layers: 'lunar-resources:MAGNESIUM',
          parameters: {
            transparent: true,
            format: 'image/png'
          }
        })
      );
      break;

    case 'CALCIUM':
      if (viewer.imageryLayers.length > 1) { viewer.imageryLayers.remove(viewer.imageryLayers.get(1)) };
      viewer.imageryLayers.addImageryProvider(
        new Cesium.WebMapServiceImageryProvider({
          url: mapServerWmsUrl,
          layers: 'lunar-resources:CALCIUM',
          parameters: {
            transparent: true,
            format: 'image/png'
          }
        })
      );
      break;

    case 'TITANIUM':
      if (viewer.imageryLayers.length > 1) { viewer.imageryLayers.remove(viewer.imageryLayers.get(1)) };
      viewer.imageryLayers.addImageryProvider(
        new Cesium.WebMapServiceImageryProvider({
          url: mapServerWmsUrl,
          layers: 'lunar-resources:TITANIUM',
          parameters: {
            transparent: true,
            format: 'image/png'
          }
        })
      );
      break;

    case 'IRON':
      if (viewer.imageryLayers.length > 1) { viewer.imageryLayers.remove(viewer.imageryLayers.get(1)) };
      viewer.imageryLayers.addImageryProvider(
        new Cesium.WebMapServiceImageryProvider({
          url: mapServerWmsUrl,
          layers: 'lunar-resources:IRON',
          parameters: {
            transparent: true,
            format: 'image/png'
          }
        })
      );
      break;

    default:
      if (viewer.imageryLayers.length > 1) { viewer.imageryLayers.remove(viewer.imageryLayers.get(1)) };
      break;
  }
})

/*
    Fonction d'appel d'information de pixel du serveur WMS
*/
//TODO: prendre en charge le "Could not extract pixel value from response: no features were found"
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
      console.log(pixelValue);
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