#!/bin/bash
# ============================================================
# Lunar Prospector - Potassium 2°
# Source    : potassium2d.dat (PDS, version June 15, 2002)
# Output    : potassium2d_COG.tif
# CRS       : IAU:30100 (Moon 2015 / Ocentric)
# Units     : K ppm (raw INT16 - NO scaling, binary = ASCII values)
# GDAL      : 3.12.2
# PROJ      : 9.8.0
# Python    : 3.12.13 (OSGeo4W)
# Requires  : GDAL >= 3.4, PROJ >= 8.1
# NOTE      : Potassium binary values are NOT multiplied by 10 (unlike other
#             elements). Binary integers equal the ASCII ppm values directly.
# ============================================================

# Step 1 - Convert raw INT16 → Float32 K ppm (no rescaling needed)
gdal_calc.py \
  -A potassium2d.vrt \
  --outfile=potassium_scaled.tif \
  --calc="A.astype(float)" \
  --type=Float32 \
  --NoDataValue=-9999 \
  --overwrite

# Step 2 - Write Cloud Optimised GeoTIFF (VRT reads rows in reverse → already north-up)
gdal_translate \
  -of COG \
  -a_ullr -180 90 180 -90 \
  -co "COMPRESS=DEFLATE" \
  -co "PREDICTOR=3" \
  -co "BLOCKSIZE=256" \
  -co "OVERVIEW_RESAMPLING=AVERAGE" \
  -co "OVERVIEWS=AUTO" \
  potassium_scaled.tif \
  potassium2d_COG.tif

# Step 3 - Remove intermediate file
rm potassium_scaled.tif

echo "Done → potassium2d_COG.tif"
