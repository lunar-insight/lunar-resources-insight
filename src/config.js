/*
    DO NOT EDIT THIS PART - FROM LOCAL .ENV FILE
*/

// The url of the geographical data server used
export const mapServerUrl = process.env.MAP_SERVER_URL;

// WMS version of the geographical server link
export const mapServerWmsUrl = `${mapServerUrl}/wms`;

// Check if authentication is required to fetch the data from the geographical server
export const mapServerRequireAuthentification = process.env.MAP_SERVER_REQUIRE_AUTHENTIFICATION === 'true';

// Set up authentication credentials from the .env file if required
export const mapServerUsername = mapServerRequireAuthentification ? process.env.MAP_SERVER_USERNAME : null;
export const mapServerPassword = mapServerRequireAuthentification ? process.env.MAP_SERVER_PASSWORD : null;

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
        map_server_name: 'nomenclature' // Name of the nomenclature layer in GeoServer
    },
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
