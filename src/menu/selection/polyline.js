export function drawPolyline(Cesium, viewer, handler, isPolylineDrawing) {

    let polyline = null;
    let polylinePositions = [];

    isPolylineDrawing = !isPolylineDrawing;

    if (isPolylineDrawing) {

        handler.setInputAction((click) => {
        
            const cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);

            if (Cesium.defined(cartesian)) {
                const lastPosition = polylinePositions[polylinePositions.length - 1];
                if (lastPosition && Cesium.Cartesian3.equals(lastPosition, cartesian)) {
                    return;
                }

                const clonedCartesian = Cesium.Cartesian3.clone(cartesian);

                polylinePositions.push(clonedCartesian);

                if (!polyline) {
                    polyline = viewer.entities.add({
                        name: 'Polyline',
                        polyline: {
                            positions: new Cesium.CallbackProperty(() => polylinePositions.slice(), false),
                            width: 3,
                            material: Cesium.Color.CYAN,
                        }
                    });
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    } else {
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        polyline = null;
        polylinePositions = [];
    }

    return isPolylineDrawing;
}