#!/bin/bash
# ============================================================
# Lunar Prospector - Oxygen 5°
# Source    : oxygen5d.dat (PDS, version June 15 2002)
# Output    : oxygen5d_COG.tif
# CRS       : IAU:30100 (Moon 2015 / Ocentric)
# Units     : O weight percent (raw INT16 ÷ 10)
# GDAL      : 3.12.2
# PROJ      : 9.8.0
# Python    : 3.12.13 (OSGeo4W)
# Requires  : GDAL >= 3.4, PROJ >= 8.1
# ============================================================

# Step 1 - Scale raw INT16 → Float32 O wt%
gdal_calc.py \
  -A oxygen5d.vrt \
  --outfile=oxygen_scaled.tif \
  --calc="A/10.0" \
  --type=Float32 \
  --NoDataValue=-9999 \
  --overwrite

# Step 2 - Write Cloud Optimised GeoTIFF (north-up: UL=-180,90 LR=180,-90)
gdal_translate \
  -of COG \
  -a_ullr -180 90 180 -90 \
  -co "COMPRESS=DEFLATE" \
  -co "PREDICTOR=3" \
  -co "BLOCKSIZE=256" \
  -co "OVERVIEW_RESAMPLING=AVERAGE" \
  -co "OVERVIEWS=AUTO" \
  oxygen_scaled.tif \
  oxygen5d_COG.tif

# Step 3 - Remove intermediate file
rm oxygen_scaled.tif

echo "Done → oxygen5d_COG.tif"
