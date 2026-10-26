# Lunar Resources Insight

## _The 3D mapping web application dedicated to lunar resources data_

Lunar Resources Insight is a easy-to use web application dedicated to lunar resources.

## Important information

This project is a work in progress and not in a ready to use state.

## Technology

Lunar Resources Insight use different technologies to work properly:

- [Node.js](https://nodejs.org/) - Javascript runtime environment.
- [Vite](https://vitejs.dev/) - Frontend build tool and dev server.
- [CesiumJS](https://cesium.com/platform/cesiumjs/) - 3D globe.
- [Docker](https://www.docker.com/) - Runs the dev server, the tests, npm and the production image.
- [Planetcantile](https://github.com/AndrewAnnex/planetcantile)

`docs/architecture/build-and-dependency-security.md` explains where npm package code runs and what the builds check.

### Configuration

Create `.env` in the project root; it holds local paths and is not committed. `.env.production` holds no secrets and is committed.

### ENV Files

Two env files are used, one per environment. The dev server reads `.env`; the production image build reads `.env.production`.

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
TERRAIN_PATH=<path to the terrain directory>

# Host path to the raster directory, the same value as DATA_PATH in planetcantile's .env.
# Read by the point index generator and mounted read-only into the proxy.
DATA_PATH=<path to the raster directory>
```

**`.env.production`** (production only):

```
NODE_ENV=production

# Empty string: tile API calls use relative paths (/cog/, /stac/, /colorMaps/)
# so they route through the production nginx on the same origin.
VITE_SERVER_URL=

# Container-internal base path for COG requests sent to planetcantile. Always /data.
VITE_WORKSPACE_PATH=/data

# Terrain served by the production nginx on the same origin.
VITE_TERRAIN_URL=/terrain
```

> `VITE_SERVER_URL` must not be removed entirely. An empty string is intentional and routes requests through nginx. Without `VITE_SERVER_URL` or `VITE_WORKSPACE_PATH`, the app throws on startup.


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
node --env-file=.env --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/generate-point-index.mjs
```

It writes `<DATA_PATH>/index/point-index.json` and `<DATA_PATH>/index/assets.json`,
restarts the point tiler instance, and compares the raster directory with
`src/layersConfig.ts`. Run it after adding, removing or renaming a raster.
Neither file is committed.

## Development

npm package code runs only in containers, never on the host. Requires Docker and the planetcantile containers.

Each start of the dev server or the tests first runs `launch-check`: npm audit and the OSV database check the lockfile, and a high or critical advisory or a known malicious package stops the launch (`docker compose logs launch-check` shows why). Without internet it warns and continues. To start despite an advisory that has no fix yet: `docker compose up -d --no-deps dev terrain proxy`.

```sh
docker compose up -d --build -V
```

| Service | URL |
|---------|-----|
| App | http://localhost:5173 |
| Terrain | http://localhost:3001 |

| Situation | Command |
|-----------|---------|
| First start, or after a change to the dependencies or `Dockerfile.dev` | `docker compose up -d --build -V` (`-V` renews the `node_modules` volume) |
| Restart | `docker compose up -d` |
| Code changes | None, the page reloads |
| Stop | `docker compose down` |

`scripts/open-app.sh` opens the app in a separate Firefox profile whose pages can reach only localhost.

`scripts/sync-node-modules.sh` copies `node_modules` from the dev image to the host for editor types. Run it after `docker compose build dev`. Nothing in that copy runs on the host.

### Tests

```sh
docker compose run --rm test               # full suite
docker compose run --rm test run <file>    # one file
docker compose run --rm test watch [file]  # rerun on save
```

The test container has no network and reads the source read-only.

### Dependencies

npm runs through `scripts/deps.sh`, in a container that cannot reach the host files. `.npmrc` refuses versions published less than 7 days ago and saves exact versions.

```sh
scripts/deps.sh install --package-lock-only <package>@<version>
scripts/deps.sh uninstall --package-lock-only <package>
scripts/deps.sh audit fix --package-lock-only    # repeat until the lockfile stops changing
scripts/deps.sh outdated
```

After a change:

1. Review the lockfile: `git show HEAD:package-lock.json > /tmp/old.json`, then `node scripts/lockdiff.cjs /tmp/old.json package-lock.json`. It lists the changed packages and flags any not served by registry.npmjs.org or without an integrity hash.
2. `docker compose build dev` (fails on a high advisory or an invalid signature), `docker compose up -d -V`, run the tests, `scripts/sync-node-modules.sh`.
3. `scripts/osv-scan.sh` checks the lockfile against the OSV database, which also lists known malicious packages.

New advisories appear after a dependency is installed. `launch-check` catches them at the next start, without a rebuild.

A security fix younger than 7 days needs an exception:

1. Check that the advisory applies: the package reaches production (`scripts/deps.sh ls <package>`) and the vulnerable code is used.
2. Review the change: `scripts/deps.sh diff --min-release-age=0 --diff=<package>@<old> --diff=<package>@<new>`.
3. Install it alone: `scripts/deps.sh install --package-lock-only --min-release-age-exclude=<package> <package>@<new>`.
4. Record the package, version, date and reason in the commit message.

Base images (`node`, `openresty`, OSV-Scanner) are pinned by digest in the Dockerfiles, `docker-compose.yml` and `scripts/osv-scan.sh`. Update them on purpose, to a build published at least 7 days earlier, and keep the version tag next to the digest.

## Production

Vite bakes environment variables at build time, so `.env.production` must exist before building.

```sh
docker build --no-cache -t lunar-resources-insight .
```

`--no-cache` makes the audit and the signature check run again; a cached build reuses their earlier result. The build fails on a high advisory, a known malicious package, an invalid signature, a missing or loosened security setting (`scripts/check-hardening.cjs`), a failing test, or a host in the bundle that is missing from `scripts/bundle-hosts.txt`.

After editing `.npmrc`, a Dockerfile, `docker-compose.yml` or an nginx config, run `node scripts/check-hardening.cjs`. On the host it also checks the dev nginx template, which the build does not see. `node --test "scripts/tests/*.test.cjs"` tests the checks themselves (the build runs it too); run it after changing a check script.

The image proxies `/cog/` and `/colorMaps/` to `planetcantile` and `/stac/point` to `planetcantile-point`, so the container joins their network. That network is internal, so the port is published on the default network first. Terrain tiles are served at `/terrain/` from a read-only mount of the terrain directory:

```sh
docker create --name lunar-resources-insight -p 8080:80 \
  -v <DATA_PATH>/index:/srv/point-index:ro \
  -v <TERRAIN_PATH>:/srv/static/terrain:ro lunar-resources-insight
docker network connect planetcantile_app-net lunar-resources-insight
docker start lunar-resources-insight
```

`<DATA_PATH>` and `<TERRAIN_PATH>` are the same directories as in `.env`. Open `http://localhost:8080`.
