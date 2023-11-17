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
    sld += `    <Name>${mapServerWorkspaceName}:${layerConfig.mapName}</Name>`; // Recommended for future use case, but not used to determine which layer the style is applied to, because we already specified in the WMS request URL
    sld += '      <sld:UserStyle>';
    sld += '        <sld:FeatureTypeStyle>';
    sld += '          <sld:Rule>';
    sld += '            <sld:RasterSymbolizer>';
    sld += '              <sld:Normalize>';
    sld += `                <sld:VendorOption name="algorithm">StretchToMinimumMaximum</VendorOption>`;
    sld += `                <sld:VendorOption name="minValue">${layerMinMax.min}</VendorOption>`;
    sld += `                <sld:VendorOption name="maxValue">${layerMinMax.max}</VendorOption>`;
    sld += '              </sld:Normalize>';
    sld += '              <sld:ColorMap extended="true" type="ramp">';

    paletteColors.forEach((color, index) => {
        const quantity = index * (255 / (paletteColors.length -1));
        sld += `<sld:ColorMapEntry color="${color}" quantity="${quantity}" />`;
    });

    sld += '              </sld:ColorMap>';
    sld += '            </sld:RasterSymbolizer>';
    sld += '          </sld:Rule>';
    sld += '        </sld:FeatureTypeStyle>';
    sld += '      </sld:UserStyle>';
    sld += '  </NamedLayer>';
    sld += '</StyledLayerDescriptor>';

    return sld;
}