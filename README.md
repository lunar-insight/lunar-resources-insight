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

Create the env files listed below in the project root. They are not committed. Add them to `.gitignore`.

### ENV Files

Two env files are used, one per environment. Vite loads `.env` always and `.env.production` automatically when running `npm run build`, with `.env.production` taking priority.

**`.env`** (development only, not committed):

```
NODE_ENV=development

# Empty string: tile API calls use relative paths (/cog/, /stac/, /colorMaps/)
# routed through the nginx dev proxy on the same origin, avoiding cross-origin issues.
VITE_SERVER_URL=

# Container-internal base path for COG (.tif) tile requests sent to planetcantile.
# Always /data. The actual host directory is set via DATA_PATH in planetcantile's .env file.
VITE_WORKSPACE_PATH=/data

# Port the terrain server listens on. Must match TERRAIN_PORT below.
VITE_TERRAIN_URL=http://localhost:3001

# Port used by both the terrain container and the nginx proxy (docker compose).
TERRAIN_PORT=3001

# Host path to the Cesium terrain tiles directory, mounted read-only into the terrain container.
TERRAIN_PATH=D:/Terrain/cesium-terrain

# Host path to the raster directory, the same value as DATA_PATH in planetcantile's .env.
# Read by the point index generator and mounted read-only into the proxy.
DATA_PATH=D:/Data/titiler_custom/map
```

**`.env.production`** (production only, not committed):

```
NODE_ENV=production

# Empty string: tile API calls use relative paths (/cog/, /stac/, /colorMaps/)
# so they route through the production nginx on the same origin.
VITE_SERVER_URL=
```

> `VITE_SERVER_URL` must not be removed entirely. An empty string is intentional and routes requests through nginx. Removing the variable causes the app to throw on startup.


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

### Point index

The scanner reads every selected layer in one request, against a STAC item that
lists the rasters as assets. The item is generated from the raster directory:

```sh
npm run point-index
```

It writes `<DATA_PATH>/index/point-index.json` and `<DATA_PATH>/index/assets.json`,
restarts the point tiler instance, and compares the raster directory with
`src/layersConfig.ts`. Run it after adding, removing or renaming a raster.
Neither file is committed.

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

Builds the application and serves it with OpenResty (nginx + Lua). Vite bakes environment variables at build time, so `.env.production` must exist before building.

```sh
docker build -t lunar-resources-insight .
docker run -p 8080:80 lunar-resources-insight
```

Open `http://localhost:8080`.

The production image proxies `/cog/` and `/colorMaps/` to a `planetcantile` upstream and `/stac/point` to a `planetcantile-point` upstream. For these to resolve, the container must be on the same Docker network as both running instances. `/point-index/assets.json` is served from a read-only mount of the point index directory:

```sh
docker run -p 8080:80 --network planetcantile_app-net \
  -v D:/Data/titiler_custom/map/index:/srv/point-index:ro \
  lunar-resources-insight
```
