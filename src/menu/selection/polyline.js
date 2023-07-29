export function drawPolyline(Cesium, viewer, handler, isPolylineDrawing) {

    let polyline = null;
    let polylinePositions = [];
    let tempLine = null;
    let polylineCollection = new Cesium.PolylineCollection();

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

                if (tempLine) {
                    polylineCollection.remove(tempLine);
                    tempLine = null;
                }

                if (polyline) {
                    polyline.positions = Cesium.PolylinePipeline.generateCartesianArc({
                        positions: polylinePositions,
                    });
                } else {
                    polyline = polylineCollection.add({
                        positions: [],
                        width: 3,
                        material: Cesium.Material.fromType(Cesium.Material.ColorType, {
                            color: new Cesium.Color(0, 1, 1, 1.0)
                        }),
                    });
                    viewer.scene.primitives.add(polylineCollection);
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        handler.setInputAction((movement) => {
            const cartesian = viewer.camera.pickEllipsoid(movement.endPosition, viewer.scene.globe.ellipsoid);

            if (Cesium.defined(cartesian) && polylinePositions.length > 0) {
                const lastPosition = polylinePositions[polylinePositions.length -1];

                if (tempLine) {
                    polylineCollection.remove(tempLine);
                }

                tempLine = polylineCollection.add({
                    positions: Cesium.PolylinePipeline.generateCartesianArc({
                        positions: [lastPosition, cartesian],
                    }),
                    width: 3,
                    material: Cesium.Material.fromType(Cesium.Material.ColorType, {
                        color: new Cesium.Color(0, 1, 1, 0.5)
                    }),
                });
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    } else {
        handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
        handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        if (polyline) {
            polylineCollection.remove(polyline);
        }
        if (tempLine) {
            polylineCollection.remove(tempLine);
        }
        polyline = null;
        polylinePositions = [];
        tempLine = null;
    }

    return isPolylineDrawing;
}
