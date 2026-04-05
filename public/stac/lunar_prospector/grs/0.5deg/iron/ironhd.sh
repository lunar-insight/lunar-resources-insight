#!/bin/bash
# ============================================================
# Lunar Prospector - Iron 0.5° (half-degree)
# Source    : ironhd.dat (PDS, version Jan. 3, 2002)
# Output    : ironhd_COG.tif
# CRS       : IAU:30100 (Moon 2015 / Ocentric)
# Units     : FeO wt% (raw INT16 ÷ 10)
# GDAL      : 3.12.2
# PROJ      : 9.8.0
# Python    : 3.12.13 (OSGeo4W)
# OSGeo4W   : 2024 (64-bit)
# Requires  : GDAL >= 3.4, PROJ >= 8.1
# ============================================================

# Step 1 - Scale raw INT16 → Float32 FeO wt%
gdal_calc.py \
  -A ironhd.vrt \
  --outfile=ironhd_scaled.tif \
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
  ironhd_scaled.tif \
  ironhd_COG.tif

# Step 3 - Remove intermediate file
rm ironhd_scaled.tif

echo "Done → ironhd_COG.tif"
