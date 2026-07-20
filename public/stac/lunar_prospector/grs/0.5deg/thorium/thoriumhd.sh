#!/bin/bash
# ============================================================
# Lunar Prospector - Thorium 0.5° (half-degree)
# Source    : thoriumhd.dat (PDS, version Jan. 3, 2002)
# Output    : thoriumhd_COG.tif
# CRS       : IAU:30100 (Moon 2015 / Ocentric)
# Units     : Th ppm (raw INT16 ÷ 10)
# GDAL      : 3.12.2
# PROJ      : 9.8.0
# Python    : 3.12.13 (OSGeo4W)
# Requires  : GDAL >= 3.4, PROJ >= 8.1
# ============================================================

# Step 1 - Scale raw INT16 → Float32 Th ppm
gdal_calc.py \
  -A thoriumhd.vrt \
  --outfile=thoriumhd_scaled.tif \
  --calc="A/10.0" \
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
  thoriumhd_scaled.tif \
  thoriumhd_COG.tif

# Step 3 - Remove intermediate file
rm thoriumhd_scaled.tif

echo "Done → thoriumhd_COG.tif"
