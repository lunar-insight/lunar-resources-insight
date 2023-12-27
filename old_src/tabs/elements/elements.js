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

// Selection container click event

export function paletteMenuSelectionElementInitialisation() {
  const paletteMenuSelection = document.querySelector('.element-mapgradient-container__palette-container__menu');
  let isMenuVisible = false;

  document.querySelector('.element-mapgradient-container__palette-container__selection').addEventListener('click', function(event) {
    if (isMenuVisible) {
      paletteMenuSelection.style.visibility = "hidden";
    } else {
      paletteMenuSelection.style.visibility = "visible";
    }
    
    isMenuVisible = !isMenuVisible;
    event.stopPropagation();
  });

  document.addEventListener('click', function(event) {
    if (!paletteMenuSelection.contains(event.target)) {
      paletteMenuSelection.style.visibility = "hidden";
      isMenuVisible = false;
    }
  });
};

import { colorbrewer } from 'colorbrewer';
import { createSldStringForPalette } from 'dynamicSldStyle';
import { updateElementLayer, getActiveLayer, getActiveLayerName } from 'updateElementLayer';

// Variable to store the currently selected palette color
let currentPaletteColors = [];

function createPaletteGradient(name, colors) {
  const gradient = `linear-gradient(to right, ${colors.join(', ')})`;
  const paletteElement = document.createElement('div');
  paletteElement.className = 'element-mapgradient-container__palette-container__menu__item look-left-tooltip-trigger';
  paletteElement.setAttribute('data-tooltip', name) // Set the name of the palette automatically in the tooltip
  paletteElement.style.background = gradient; // Use the linear-gradient()

  // Store the color in the global variable
  currentPaletteColors = colors;

  // Add click event listener to each palette element
  paletteElement.addEventListener('click', function() {

    // Update the gradient in the UI
    const selectionGradient = document.querySelector('.element-mapgradient-container__palette-container__selection__gradient');
    selectionGradient.style.background = gradient;

    // Verify if activeLayer is not null here before sending the request
    const activeLayer = getActiveLayer();
    if (activeLayer) {

      // Generate the SLD string for the selected palette
      const elementName = getActiveLayerName();
      const sldString = createSldStringForPalette(elementName, colors);

      // Update the element layer with the new SLD
      updateElementLayer(elementName, sldString)
    }
  });

  return paletteElement;
}

/*
  This function put all the colorbrewer's palette in the palette selection menu
*/

export function populatePaletteMenu() {
  const menuContainer = document.querySelector('.element-mapgradient-container__palette-container__menu');
  const selectionGradient = document.querySelector('.element-mapgradient-container__palette-container__selection__gradient');

  // Clear existing content
  while (menuContainer.firstChild) {
    menuContainer.removeChild(menuContainer.firstChild)
  }

  Object.entries(colorbrewer).forEach(([name, palette]) => {
    const maxColors = palette[Object.keys(palette).sort((a, b) => b - a)[0]]; // Find the largest number in an array of numbers, by sorting the array in descending order
    const paletteElement = createPaletteGradient(name, maxColors); // Pass the palette name and the colors values
    menuContainer.appendChild(paletteElement);

    // Set the 'Spectral' gradient as the default background
    if (name === 'Spectral') {
      const spectralGradient = `linear-gradient(to right, ${maxColors.join(', ')})`;
      selectionGradient.style.background = spectralGradient;
      currentPaletteColors = maxColors; // Set the global variable with default palette colors
    }
  });
}

/*
  Function to get the current palette colors
*/

export function getCurrentPaletteColors() {
  return currentPaletteColors;
}