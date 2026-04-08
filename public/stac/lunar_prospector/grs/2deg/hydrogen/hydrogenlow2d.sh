#!/bin/bash
# ============================================================
# Lunar Prospector - Hydrogen (low-altitude) 2°
# Source    : hydrogenlow.dat (PDS, version July 6, 2001)
# Output    : hydrogenlow2d_COG.tif
# CRS       : IAU:30100 (Moon 2015 / Ocentric)
# Units     : H ppm (raw INT16 ÷ 10)
# GDAL      : 3.12.2
# PROJ      : 9.8.0
# Python    : 3.12.13 (OSGeo4W)
# Requires  : GDAL >= 3.4, PROJ >= 8.1
# NOTE      : Hydrogen abundances are not necessarily reliable in regions of
#             high thorium and rare-earth element abundances (Maurice et al.
#             2001a). Use with caution in KREEP-rich terranes.
# ============================================================

# Step 1 - Scale raw INT16 → Float32 H ppm
gdal_calc.py \
  -A hydrogenlow2d.vrt \
  --outfile=hydrogen_scaled.tif \
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
  hydrogen_scaled.tif \
  hydrogenlow2d_COG.tif

# Step 3 - Remove intermediate file
rm hydrogen_scaled.tif

echo "Done → hydrogenlow2d_COG.tif"
