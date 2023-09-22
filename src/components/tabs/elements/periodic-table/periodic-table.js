import { updateElementLayer } from 'updateElementLayer';

document.addEventListener("DOMContentLoaded", function() {
    const elements = document.querySelectorAll('.periodic-element');
    const selectedElementContainer = document.querySelector('.element-container__selection');

    elements.forEach(element => {
        const period = element.getAttribute('data-element-period');
        const group = element.getAttribute('data-element-group');
        const elementId = element.getAttribute('data-element-name');

        element.style.gridArea = `${period} / ${group}`;

        element.addEventListener('click', function() {
            
            const elementAbbreviation = element.querySelector('.periodic-element__abbreviation').innerText;
            const elementName = element.querySelector('.periodic-element__name').innerText;
            const elementAtomicNumber = element.querySelector('.periodic-element__atomic-number').innerText;
            const elementAtomicMass = element.querySelector('.periodic-element__atomic-mass').innerText;

            if (!document.getElementById(elementId)) {

                selectedElementContainer.textContent = "";

                const newElementSquare = document.createElement('div');
                newElementSquare.id = elementId;
                newElementSquare.classList.add('selected-element-square');

                const newElementAbbr = document.createElement('abbr');
                newElementAbbr.classList.add('selected-element-square__abbreviation');
                newElementAbbr.textContent = elementAbbreviation;

                const newElementName = document.createElement('span');
                newElementName.classList.add('selected-element-square__name');
                newElementName.textContent = elementName;

                const newElementAtomicNumber = document.createElement('span');
                newElementAtomicNumber.classList.add('selected-element-square__atomic-number');
                newElementAtomicNumber.textContent = elementAtomicNumber;

                const newElementAtomicMass = document.createElement('span');
                newElementAtomicMass.classList.add('selected-element-square__atomic-mass');
                newElementAtomicMass.textContent = elementAtomicMass;

                newElementSquare.appendChild(newElementAbbr);
                newElementSquare.appendChild(newElementName);
                newElementSquare.appendChild(newElementAtomicNumber);
                newElementSquare.appendChild(newElementAtomicMass);

                selectedElementContainer.appendChild(newElementSquare);

                updateElementLayer(elementName);
            }
        })
    });
});