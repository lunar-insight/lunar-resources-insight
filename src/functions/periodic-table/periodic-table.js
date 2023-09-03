document.addEventListener("DOMContentLoaded", function() {
    const elements = document.querySelectorAll('.periodic-element');

    elements.forEach(element => {
        const period = element.getAttribute('data-element-period');
        const group = element.getAttribute('data-element-group');

        element.style.gridArea = `${period} / ${group}`;
    });
});