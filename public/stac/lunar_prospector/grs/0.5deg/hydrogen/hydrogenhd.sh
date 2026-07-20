#!/bin/bash
# ============================================================
# Lunar Prospector - Hydrogen 0.5° (half-degree)
# Source    : hydrogenhd.dat (PDS, version Jan. 3, 2002)
# Output    : hydrogenhd_COG.tif
# CRS       : IAU:30100 (Moon 2015 / Ocentric)
# Units     : H ppm (raw INT16 ÷ 10)
# GDAL      : 3.12.2
# PROJ      : 9.8.0
# Python    : 3.12.13 (OSGeo4W)
# Requires  : GDAL >= 3.4, PROJ >= 8.1
# NOTE      : Hydrogen abundances are not necessarily reliable in regions of
#             high thorium and rare-earth element abundances (Maurice et al.
#             2001a). Use with caution in KREEP-rich terranes (elevated Th,
#             K & REE drive neutron bias).
# ============================================================

# Step 1 - Scale raw INT16 → Float32 H ppm
gdal_calc.py \
  -A hydrogenhd.vrt \
  --outfile=hydrogenhd_scaled.tif \
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
  hydrogenhd_scaled.tif \
  hydrogenhd_COG.tif

# Step 3 - Remove intermediate file
rm hydrogenhd_scaled.tif

echo "Done → hydrogenhd_COG.tif"
