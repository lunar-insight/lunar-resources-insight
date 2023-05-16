// TODO : Retirer le async pour la sélection
// TODO : Transparence du raster
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

const mouseButton = document.createElement('button');
mouseButton.innerHTML = "Mouse Data";
const toolbar = document.getElementsByClassName('cesium-viewer-toolbar')[0];
toolbar.appendChild(mouseButton);

mouseButton.addEventListener('click', function() {
  const entity = viewer.entities.add({
    label: {
      show: false,
      showBackground: true,
      font: "14px monospace",
      horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(15, 0),
    }
  });

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
});



// }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

// viewer.cesiumWidget.screenSpaceEventHandler.setInputAction(function onMouseMove(movement) {
//   let ellipsoid = viewer.scene.globe.ellipsoid;
//   let cartesian = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
//   if (cartesian) {
//     let cartographic = Cesium.Cartographic.fromCartesian(cartesian);

    

//     let positionString = '(' + longitudeString + ', ' + latitudeString + ')';
//     console.log(positionString)
    //let mousePosition = new Cesium.Cartesian2(movement.endPosition.x, movement.endPosition.y)
    //console.log(viewer.scene.canva.getContext('webgl'));
    //let pixelColor = viewer.scene.canvas.getContext('2d').getImageData(mousePosition.x, mousePosition.y, 1, 1).data;
    //console.log(pixelColor)
    

    // Récupération de la valeur du pixel
    //console.log(viewer.camera.pickEllipsoid(movement.endPosition, viewer.scene.globe.ellipsoid))
    //var pixelValue = viewer.scene.globe.pick(viewer.camera.getPickRay(movement.endPosition))
    //console.log(pixelValue)
/*     if (pixelValue) {
      console.log("Position : ", positionString, ", Pixel value : ", pixelValue);
    } else {
      console.log("Position : ", positionString, ", Pixel value : No data");
    } */


    //console.log(positionString);
//   }
// }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);



/* viewer.cesiumWidget.screenSpaceEventHandler.setInputAction(function onMouseMove(movement) {
  
  var ellipsoid = viewer.scene.globe.ellipsoid;
  var cartesian = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
  
  if (cartesian) {

    // Convertion des coordonnées cartographiques en coordonnées de canvas
    var windowPosition = Cesium.SceneTransforms.wgs84ToWindowCoordinates(viewer.scene, cartesian);

    // Création d'un canevas caché pour récupérer la valeur du pixel
    var canvas = document.createElement("canvas");
    var context = canvas.getContext("2d");
    canvas.width = viewer.scene.canvas.clientWidth;
    canvas.height = viewer.scene.canvas.clientHeight;
    context.drawImage(viewer.scene.canvas, 0, 0, canvas.width, canvas.height);
    console.log(context);

    // Récupération de la valeur du pixel à partir du canvas
    var pixelData = context.getImageData(windowPosition.x, canvas.height - windowPosition.y, 1, 1).data;
    var pixelValue = pixelData[0];

    // Affichage de la position et de la valeur du pixel dans la console

    var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    var longitudeString = Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);
    var latitudeString = Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);
    var positionString = '(' + longitudeString + ', ' + latitudeString + ')';
    console.log(pixelValue);
/*     if (pixelValue) {
      console.log("Position : ", positionString, ", Pixel value : ", pixelValue);
    } else {
      console.log("Position : ", positionString, ", Pixel value : No data");
    } */
//  }
//}, Cesium.ScreenSpaceEventType.MOUSE_MOVE); */


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
      //http://localhost:8090/geoserver/lunar-resources/wms/reflect?service=WMS&version=1.1.1&request=GetFeatureInfo&layers=lunar-resources%3AGlobal20ppd_SRV_LPGRS_geotiffCa_tiles&bbox=-180.0%2C-74.99583217560433%2C180.0%2C74.99583217560433&width=768&height=330&srs=EPSG%3A4326&styles=&format=application/openlayers
      format: "image/png",
      bbox: `${longitude - 0.1},${latitude - 0.1},${longitude + 0.1},${latitude + 0.1}`,
      // Mettre defaut a 1 pour avoir l'erreur classique
      width: 2,
      height: 2,
      query_layers: 'lunar-resources:'+layersList.value,
      info_format: "text/plain",
      x: 1,
      y: 1,
    },
  });
  try {
    const response = await url.fetch();
    if (response instanceof Response && response.ok) {
      const text = await response.text();
      const pixelValue = parseFloat(text);
      console.log(pixelValue);
      return pixelValue;
    } else {
      console.error("Invalid or unexpected response from the map server:", response);
      return null;
    }
  } catch (error) {
    console.error("Error fetching GetFeatureInfo:", error);
    return null;
  }
}


/*   try {
    const response = await url.fetch();

    if (response instanceof Response && response.ok) {
      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/html");
      const pixelValue = parseFloat(doc.querySelector("p").textContent);
      console.log(pixelValue);
      return pixelValue;
    } else {
      console.error("Invalid or unexpected response from the map server:", response);
      return null;
    }
  } catch (error) {
    console.error("Error fetching GetFeatureInfo:", error);
    return null;
  }
} */

