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

function createPaletteGradient(name, colors) {
  const gradient = `linear-gradient(to right, ${colors.join(', ')})`;
  const paletteElement = document.createElement('div');
  paletteElement.className = 'element-mapgradient-container__palette-container__menu__item look-left-tooltip-trigger';
  paletteElement.setAttribute('data-tooltip', name) // Set the name of the palette automatically in the tooltip
  paletteElement.style.background = gradient; // Use the linear-gradient()
  return paletteElement;
}

export function populatePaletteMenu() {
  const menuContainer = document.querySelector('.element-mapgradient-container__palette-container__menu');

  // Clear existing content
  while (menuContainer.firstChild) {
    menuContainer.removeChild(menuContainer.firstChild)
  }

  Object.entries(colorbrewer).forEach(([name, palette]) => {
    const maxColors = palette[Object.keys(palette).sort((a, b) => b - a)[0]]; // Find the largest number in an array of numbers, by sorting the array in descending order
    const paletteElement = createPaletteGradient(name, maxColors); // Pass the palette name and the colors values
    menuContainer.appendChild(paletteElement);
  });
}