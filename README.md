# Lunar Resources Insight

## _The 3D mapping web application dedicated to lunar resources data_

Lunar Resources Insight is a easy-to use web application dedicated to lunar resources.

## Important information

This project is a work in progress and not in a ready to use state.

## Technology

Lunar Resources Insight use different technologies to work properly:

- [Node.js](https://nodejs.org/) - Javascript runtime environment.
- [Vite](https://vitejs.dev/) - Frontend build tool and dev server.
- [Planetcantile](https://github.com/AndrewAnnex/planetcantile)

### Configuration

Create a private .env config file in your project at the same level

1. Create an `.env` file in the project directory.
2. In the `.env` file, add the following environment variable with your local information:

Edit the config.js file with your map server configuration with your workspace name and layer name assuming you are using GeoServer.

### ENV File

```
NODE_ENV=development

REACT_APP_SERVER_URL=http://127.0.0.1:8000

REACT_APP_WORKSPACE_PATH = file://C:/Your/File/Path/To/Folder

REACT_APP_TERRAIN_URL=http://localhost:3001

TERRAIN_PORT=3001

TERRAIN_PATH=D:/Terrain/cesium-terrain
```


### Terrain

The layer.json file should have EPSG:4326 due to CesiumTerrainProvider that does not support the code IAU:30100. The two projection are geographically compatible (lat/lon -90 to 90 and -180 to 180)

Command used: 

``gdalwarp -t_srs "+proj=longlat +a=1737400 +b=1737400 +no_defs" -r bilinear input.tif output.tif``

### Data

Test data:
- [Global20ppd Titanium, Calcium, Magnesium and Iron](https://zenodo.org/records/5762834)

Converted via:

```
gdal_translate -a_srs IAU_2015:30100 input.tif output.tif

gdal_translate -of COG -co "COMPRESS=DEFLATE" -co "PREDICTOR=2" ^
-co "BLOCKSIZE=256" ^
-co "OVERVIEW_RESAMPLING=AVERAGE" ^
-co "OVERVIEWS=AUTO" geology_moon.tif geology_moon_cog.tif
```

### Launch

2. Open the project in your code editor and do `npm install`
3. Start the project with `npm start`

---

## Docker

### Development

Starts the Vite dev server and the terrain server. Source files are mounted from the host.

```sh
docker compose up --build
```

| Service | URL |
|---------|-----|
| App | http://localhost:5173 |
| Terrain | http://localhost:3001 |

To stop: `docker compose down`.

#### Workflow

| Situation | Command | Note |
|-----------|---------|------|
| First start or after changing `package.json`, `package-lock.json` / `Dockerfile.dev` | `docker compose up --build` | Rebuilds the image |
| Restart without dependency changes | `docker compose up` | Reuses cached image and `node_modules` |
| Code changes | None | Vite picks them up instantly via hot module replacement |
| Full reset (wipe volumes) | `docker compose down -v` then `--build` | Forces Vite dependency re-bundle on next start |

### Production

Builds the application and serves it with nginx.

```sh
docker build -t lunar-resources-insight .
docker run -p 8080:80 lunar-resources-insight
```

Open `http://localhost:8080`.
