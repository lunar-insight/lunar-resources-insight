// TODO : Faire un menu déroulant pour nos couches
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
  handler.setInputAction(function (movement) {
    //viewer.scene.cesiumWidget.screenSpaceEventHandler.setInputAction(function onMouseMove(movement) {
    const cartesian = viewer.camera.pickEllipsoid(movement.endPosition, scene.globe.ellipsoid);
    if (cartesian) {
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const longitudeString = Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);
      const latitudeString = Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);
      // Si la coordonnée est positive - pb si il est inférieur à 0 il ajoute quand même un espace
      const longSign = Number(longitudeString) > 0 ? ' ' : '';
      const latSign = Number(latitudeString) > 0 ? ' ' : '';

      entity.position = cartesian;
      entity.label.show = true;

      entity.label.text =
        `Lon: ${`${longSign}${longitudeString}`.slice(-11)}\u00B0` +
        `\nLat: ${`${latSign}${latitudeString}`.slice(-11)}\u00B0`;
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
option0.value = 'basemap';
layersList.add(option0);

const option1 = document.createElement('option');
option1.text = 'Magnesium';
option1.value = 'magnesium';
layersList.add(option1);

const option2 = document.createElement('option');
option2.text = 'Iron';
option2.value = 'iron';
layersList.add(option2);

const option3 = document.createElement('option');
option3.text = 'Calcium';
option3.value = 'calcium';
layersList.add(option3);

const option4 = document.createElement('option');
option4.text = 'Titanium';
option4.value = 'titanium';
layersList.add(option4);

layersList.selectedIndex = 0;

layersList.addEventListener('change', function() {

  switch (layersList.value) {

    case 'basemap':
      if (viewer.imageryLayers.length > 1) { viewer.imageryLayers.remove(viewer.imageryLayers.get(1)) };
      break;

    case 'magnesium':
      if (viewer.imageryLayers.length > 1) { viewer.imageryLayers.remove(viewer.imageryLayers.get(1)) };
      viewer.imageryLayers.addImageryProvider( new Cesium.IonImageryProvider({ assetId: 1613585 }) );
      break;

    case 'iron':
      if (viewer.imageryLayers.length > 1) { viewer.imageryLayers.remove(viewer.imageryLayers.get(1)) };
      viewer.imageryLayers.addImageryProvider( new Cesium.IonImageryProvider({ assetId: 1613584 }) );
      break;

    case 'calcium':
      if (viewer.imageryLayers.length > 1) { viewer.imageryLayers.remove(viewer.imageryLayers.get(1)) };
      viewer.imageryLayers.addImageryProvider( new Cesium.IonImageryProvider({ assetId: 1613583 }) );
      break;

    case 'titanium':
      if (viewer.imageryLayers.length > 1) { viewer.imageryLayers.remove(viewer.imageryLayers.get(1)) };
      viewer.imageryLayers.addImageryProvider( new Cesium.IonImageryProvider({ assetId: 1613582 }) );
      break;

    default:
      if (viewer.imageryLayers.length > 1) { viewer.imageryLayers.remove(viewer.imageryLayers.get(1)) };
      break;
  }
})