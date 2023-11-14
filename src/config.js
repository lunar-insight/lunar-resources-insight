/*
    DO NOT EDIT THIS PART - FROM LOCAL .ENV FILE
*/

// The url of the geographical data server used
export const mapServerUrl = process.env.MAP_SERVER_URL;

// WMS version of the geographical server link
export const mapServerWmsUrl = `${mapServerUrl}/wms`;

/*
    EDITABLE PART CONFIGURATION
*/

// The layer in geoserver is always in the format <WORKSPACE>:<LAYER_NAME>
// Workspace name used in your map server (eg. a geoserver workspace)
export const mapServerWorkspaceName = 'lunar-resources';

export const layersConfig = {
    baseLayer: {
        map_server_name: 'wac_global_100m' // Name of the base layer in GeoServer
    },
    nomenclatureLayer: {
        map_server_name: 'nomenclature' // Name of the nomenclature layer in GeoServer, from the IAU
    },
    geologicLayer: {
        map_server_name: 'unified_geologic_v2' // Usually the UnifiedGeologicMapMoon_V2 from USGS
    },
    calciumLayer: {
        map_server_name: 'calcium'
    },
    ironLayer: {
        map_server_name: 'iron'
    },
    magnesiumLayer: {
        map_server_name: 'magnesium'
    },
    titaniumLayer: {
        map_server_name: 'titanium'
    }
}

export const layerMinMaxValues = {
    'MAGNESIUM': {min: 2.08, max: 9.60},
    'IRON': {min: 2.69, max: 27.53},
    'CALCIUM': {min: 7.12, max: 13.38},
    'TITANIUM': {min: 0.08, max: 18.45},
};

export const chemicalLayerNames = ['MAGNESIUM', 'IRON', 'CALCIUM', 'TITANIUM'];

export const chemicalLayerData = {
    'MAGNESIUM': {name: 'Magnesium', number: '12', symbol: 'Mg'},
    'IRON': {name: 'Iron', number: '26', symbol: 'Fe'},
    'CALCIUM': {name: 'Calcium', number: '20', symbol: 'Ca'},
    'TITANIUM': {name: 'Titanium', number: '22', symbol: 'Ti'},
};
