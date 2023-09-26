/*
    Periodic table opener
*/

const overlay = document.getElementById("periodic-table-overlay");
const elementsTabContent = document.getElementById("elements");

export function showPeriodicTableOverlay() {
  overlay.style.display = "block";
  overlay.style.visibility = "visible";
  overlay.classList.add("open");
}

export function hidePeriodicTableOverlay() {
  overlay.style.display = "none";
  overlay.style.visibility = "hidden";
  overlay.classList.remove("open");
}

document.querySelector('.element-container__selection').addEventListener('click', function() {
  showPeriodicTableOverlay();
  elementsTabContent.style.display = "none";
});

overlay.addEventListener('click', function() {
  hidePeriodicTableOverlay();
  elementsTabContent.style.display = "flex";
})

/*
  Color palette
*/

import colorRamp from 'images/color-ramp.png';
import grayRamp from 'images/gray-ramp.png';

// Gradient container

const gradientContainer = document.querySelector('.element-mapgradient-container__palette-container__selection__gradient');
const imageGradientContainer = document.createElement('img');

imageGradientContainer.src = colorRamp;

gradientContainer.appendChild(imageGradientContainer);

// Gradient menu selector

function createElementPaletteSelectionMenuItem(imageSrc) {
  const menuItem = document.createElement('div');
  menuItem.className = 'element-mapgradient-container__palette-container__menu__item';
  
  const imgElement = document.createElement('img');
  imgElement.src = imageSrc;

  menuItem.appendChild(imgElement);

  return menuItem;
}

const menuContainer = document.querySelector('.element-mapgradient-container__palette-container__menu');

const images = [colorRamp, grayRamp];

images.forEach(image => {
  menuContainer.appendChild(createElementPaletteSelectionMenuItem(image));
});