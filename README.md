# lunar-resources-insight

## Get Started


### Configuration

Create a private .env config file in your project at the same level

1. Create an `.env` file in the project directory.
2. In the `.env` file, add the following environment variable with your local information:
```
# The map server url, where the geographical data are located, can be localhost, an ip or a specific adress (without the slash / at the end)
MAP_SERVER_URL=http://example.com/geoserver
```

Edit the config.js file with your map server configuration with your workspace name and layer name assuming you are using GeoServer.

### Installation

1. Install [Node.js](https://nodejs.org/) on your computer.
2. Install [GeoServer](https://geoserver.org/) on your computer, assuming via [docker](https://github.com/geoserver/docker) in this case.

### Data

Add required data to your map server:
- Tiled basemap
- Nomenclature
- Titanium test data
- Calcium test data
- Magnesium test data
- Iron test data

### Launch

2. Open the project in your code editor and do `npm install`
3. Start the project with `npm start`

### Error message

If you have the following message: ``<adress> has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.``

Open the web.xml file in your WEB-INF\lib directory and search for CORS. Uncomment the 2 CORS filter sections and restart geoserver.
