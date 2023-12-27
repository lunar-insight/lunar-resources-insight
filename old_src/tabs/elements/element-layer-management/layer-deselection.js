/*
    Layer deselection
*/

import { getActiveLayer, removeActiveLayer } from 'updateElementLayer';
import { viewer } from 'index';

const deselectIconBox = document.querySelector('.element-container__deselect-icon-box')

export function initialisationDeselectElementLayer() {
    const deselectIconBox = document.querySelector('.element-container__deselect-icon-box')

    deselectIconBox.addEventListener('click', function() {
        deselectElementLayer();
    })
}


export function deselectElementLayer() {
    const currentActiveLayer = getActiveLayer();
    if (currentActiveLayer) {
        viewer.imageryLayers.remove(currentActiveLayer);

        removeActiveLayer(); // Reinitialisation of activeLayer to null in the update-element-layer code

        // Element square
        const selectedElementContainer = document.querySelector('.element-container__selection');
        const selectedSquare = selectedElementContainer.querySelector('.selected-element-square');

        // If selected element visualization is present
        if (selectedSquare) {
            selectedElementContainer.removeChild(selectedSquare);
        }
    }
}