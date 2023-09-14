export const mapServerUrl = process.env.MAP_SERVER_URL;

export const mapServerWmsUrl = `${mapServerUrl}/wms`;

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