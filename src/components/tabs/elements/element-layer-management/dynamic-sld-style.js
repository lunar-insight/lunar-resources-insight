/*
    Dynamic SLD style send to GeoServer - used in element layers
*/

import { layerMinMaxValues, layersConfig, mapServerWorkspaceName } from 'config';

export function createSldStringForPalette(elementName, paletteColors) {

    const layerConfig = layersConfig[`${elementName.toLowerCase()}Layer`];
    if (!layerConfig) {
        console.error('No layer configuration found for element:', elementName);
        return '';
    }

    const layerMinMax = layerMinMaxValues[elementName.toUpperCase()];
    if (!layerMinMax) {
        console.error('No min/max values found for element:', elementName);
        return '';
    }

    let sld = '<?xml version="1.0" encoding="UTF-8"?>';
    sld += '<StyledLayerDescriptor xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" xmlns:gml="http://www.opengis.net/gml" xmlns:sld="http://www.opengis.net/sld" version="1.0.0">';
    sld += '  <NamedLayer>';
    sld += `    <sld:Name>${mapServerWorkspaceName}:${layerConfig.mapName}</sld:Name>`; // Recommended for future use case, but not used to determine which layer the style is applied to, because we already specified in the WMS request URL
    sld += '    <sld:UserStyle>';
    sld += '      <sld:FeatureTypeStyle>';
    sld += '        <sld:Rule>';
    sld += '          <sld:RasterSymbolizer>';
    sld += '            <sld:ColorMap type="ramp">';

    /*
        Using CQL expression if provided by using the 'env' function to get value,
        it default to classic value from the config.js file is not provided.

        The 'env' is a function used within the XML of the SLD to reference environment
        variables passed in a WMS request. However, it is not a standard JavaScript function
        and cannot be used directly in a JavaScript code.
        
        Here, the env function calls are included as part of the string that will be
        interpreted by GeoServer, not by JavaScript.
    */

    paletteColors.forEach((color, index) => {
        const stepSize = `((${`env('maxValue', ${layerMinMax.max})`} - ${`env('minValue', ${layerMinMax.min})`}) / (${paletteColors.length - 1}))`;
        const quantity = `${`env('minValue', ${layerMinMax.min})`} + ${index} * ${stepSize}`;
        sld += `<sld:ColorMapEntry color="${color}" quantity="${quantity}"/>`;
    })

    sld += '            </sld:ColorMap>';
    sld += '          </sld:RasterSymbolizer>';
    sld += '        </sld:Rule>';
    sld += '      </sld:FeatureTypeStyle>';
    sld += '    </sld:UserStyle>';
    sld += '  </NamedLayer>';
    sld += '</StyledLayerDescriptor>';

    return sld;
}