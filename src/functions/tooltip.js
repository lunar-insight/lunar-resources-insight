/*
    Tooltip trigger:
    use look-left-tooltip-trigger class and data-tooltip for the text

    Example:

    Any element with the class 'look-left-tooltip-trigger' will have a tooltip
    <div class="look-left-tooltip-trigger" data-tooltip="This is a tooltip text">Hover over me</div>

    Global tooltip container placed in index.html:
    <div class="global-look-left-tooltip"></div>
*/

function showTooltip(event) {
    const tooltip = document.querySelector('.global-look-left-tooltip');
    tooltip.textContent = ''; // Clear the previuous tooltip content

    // Create a span for the text content
    const tooltipTextSpan = document.createElement('span');
    tooltipTextSpan.textContent = event.currentTarget.getAttribute('data-tooltip');

    // Append the text span to the tooltip
    tooltip.appendChild(tooltipTextSpan);

    // Position calculation for the tooltip
    const rect = event.currentTarget.getBoundingClientRect();

    const tooltipHeight = 28; // In pixel

    const tabsWidthRem = 18.75 // Width of the tabs in rem
    const tabsWidth = parseFloat(getComputedStyle(document.documentElement).fontSize) * tabsWidthRem;

    const top = window.scrollY + rect.top + (rect.height / 2) - (tooltipHeight / 2); // In pixel
    const left = rect.left + tabsWidth + 15; // In rem

    tooltip.style.top =  `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.classList.add('show');
}

function hideTooltip() {
    const tooltip = document.querySelector('.global-look-left-tooltip');
    tooltip.classList.remove('show');
}

// Function to initialize tooltips, init called in index.js
export function initializeTooltips() {
    document.querySelectorAll('.look-left-tooltip-trigger').forEach(element => {
        element.addEventListener('mouseenter', showTooltip);
        element.addEventListener('mouseleave', hideTooltip);
    });
}