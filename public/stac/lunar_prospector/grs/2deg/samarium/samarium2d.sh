#!/bin/bash
# ============================================================
# Lunar Prospector - Samarium 2°
# Source    : samarium2d.dat (PDS, version July 6, 2001)
# Output    : samarium2d_COG.tif
# CRS       : IAU:30100 (Moon 2015 / Ocentric)
# Units     : Sm ug/g (raw INT16 ÷ 10)
# GDAL      : 3.12.2
# PROJ      : 9.8.0
# Python    : 3.12.13 (OSGeo4W)
# OSGeo4W   : 2024 (64-bit)
# Requires  : GDAL >= 3.4, PROJ >= 8.1
# ============================================================

# Step 1 - Scale raw INT16 → Float32 Sm ug/g
gdal_calc.py \
  -A samarium2d.vrt \
  --outfile=samarium_scaled.tif \
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
  samarium_scaled.tif \
  samarium2d_COG.tif

# Step 3 - Remove intermediate file
rm samarium_scaled.tif

echo "Done → samarium2d_COG.tif"
