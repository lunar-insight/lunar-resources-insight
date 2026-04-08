#!/bin/bash
# ============================================================
# Lunar Prospector - Titanium 2°
# Source    : titanium2d.dat (PDS, version June 15, 2002)
# Output    : titanium2d_COG.tif
# CRS       : IAU:30100 (Moon 2015 / Ocentric)
# Units     : Ti wt% (raw INT16 ÷ 10)
# GDAL      : 3.12.2
# PROJ      : 9.8.0
# Python    : 3.12.13 (OSGeo4W)
# Requires  : GDAL >= 3.4, PROJ >= 8.1
# ============================================================

# Step 1 - Scale raw INT16 → Float32 Ti wt%
gdal_calc.py \
  -A titanium2d.vrt \
  --outfile=titanium_scaled.tif \
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
  titanium_scaled.tif \
  titanium2d_COG.tif

# Step 3 - Remove intermediate file
rm titanium_scaled.tif

echo "Done → titanium2d_COG.tif"
