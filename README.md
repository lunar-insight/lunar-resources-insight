# Lunar Resources Insight

## _The 3D mapping web application dedicated to lunar resources data_

Lunar Resources Insight is a easy-to use web application dedicated to lunar resources.

## Technology

Lunar Resources Insight use different technologies on top of Javascript/HTML/CSS to work properly:

- [Node.js](https://nodejs.org/) - Javascript runtime environment.
- [Typescript](https://www.typescriptlang.org/) - Superset of Javascript that adds static types definitions.
- [React](https://react.dev/) - Javascript library for user interfaces using components.
- [Storybook](https://storybook.js.org/) - UI development tool for building and testing components in isolation.
- [Webpack](https://webpack.js.org/) - Static module bundler for javascript.
- [GeoServer](https://geoserver.org/) - Geographical data backend.

The complete list of dependencies can be seen in ``package.json``.

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
If you are using docker, mount an external directory by following the geoserver github docker initialization, in your geoserver local folder the data should be placed in data/{{custom_workspace_name}}/ with the port configured like this: ``-p 8090:8080``, this way it will be accessible with the url ``localhost:8090/geoserver``

Example commands:

To pull the official image:
```
docker pull docker.osgeo.org/geoserver:{{VERSION}}
```

To pull the image locally:
```
docker run -it -p {{LOCAL_PORT}}:8080 --env INSTALL_EXTENSIONS=true --env STABLE_EXTENSIONS="vectortiles,geopkg-output,gdal,jp2k,iau"  --env CORS_ENABLED=true --mount src="C:/Your/Local/Geoserver/Directory",target=/opt/geoserver_data/,type=bind docker.osgeo.org/geoserver:{{VERSION}}
```

When geoserver is running, you need to create a workspace, eg. ``lunar-resources``, the different service on the workspace need to be activated (WMS, WCS, WMTS and WFS). On the **Stores** category, connect to a layer and publish it. The layer will appear in the **Layers** category. For the layer publication, the default names in the config.js of the Lunar Resources Insight project can be used.

If the downloaded dataset has a style with it, you can add it in the **Styles** category in GeoServer.

The **Layers** page in GeoServer should look like this:

| Title                                 | Name                            | Store                       |
|---------------------------------------|---------------------------------|-----------------------------|
| Global20ppd_SRV_LPGRS_geotiffCa_tiles | lunar-resources:calcium         | Calcium                     |
| GeoContacts                           | lunar-resources:geo_contacts    | unified_geologic_v2         |
| GeoUnits                              | lunar-resources:geo_units       | unified_geologic_v2         |
| Global20ppd_SRV_LPGRS_geotiffFe_tiles | lunar-resources:iron            | Iron                        |
| Global20ppd_SRV_LPGRS_geotiffMg_tiles | lunar-resources:magnesium       | Magnesium                   |
| MOON_nomenclature_center_pts          | lunar-resources:nomenclature    | IAU Nomenclature            |
| Global20ppd_LPGRS_geotiffTi_tiles     | lunar-resources:titanium        | Titanium                    |
| WAC_GLOBAL_100M                       | lunar-resources:wac_global_100m | wac_global_morphologic_100m |

The *Name* category is related to the Lunar Resources Insight ``config.js`` file. The *Title* and *Store* can be any names.

### Style

Styles are in SLD format that can be incorporated into GeoServer via Data > Styles option.

- The chemical element styling is done automatically via the interface, but they also need a default styling file (eg. gray) to be present in the "GetCapabilities", as default.
- For the *Nomenclature* and the *Geologic* data, the style should be configured as default by using the provided styles from the required test data link.
- About the 'WAC Global 100m' file, you need to generate a default 'raster' style, by creating a new one directly on GeoServer in the Style category.

### Data

Download and add the [required test data](https://offworldhorizon-my.sharepoint.com/:f:/p/thibaut/EvZYOlu_bHpBt1b8KZHISR4BJv49LEsWeNWsEcjfqvry1w?e=87b22J) to your geoserver local directory, also with the style files. The test data is composed of WGS84 processed and optimised:
- Tiled basemap (WAC global 100m)
- IAU Nomenclature
- Geologic map from USGS
- Global20ppd Titanium, Calcium, Magnesium and Iron

Starting the 2.24.0 version of GeoServer, planetary CRS support was added. The data can be now in lunar coordinate system with the [GeoServer IAU planetary CRS extension](https://docs.geoserver.org/stable/en/user/extensions/iau/index.html). The data will be changed in the future to reflect this changes (Globally to IAU2015:30100 projection and related code), the Cesium globe ellipsoid will be modified to take into account the lunar ellipsoid. You will need to [download](https://sourceforge.net/projects/geoserver/files/GeoServer/) and install the extension in GeoServer.

### Using UI components

The project use [Storybook](https://storybook.js.org/) for components library. To launch the local library storybook interface, the command is ``npm start storybook``. Components can be created to be used in the project.

### Launch

1. Open the project in your code editor and do `npm install`
2. Start the project with `npm start`