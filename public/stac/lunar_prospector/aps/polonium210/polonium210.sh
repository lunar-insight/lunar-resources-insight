#!/bin/bash
# ============================================================
# Lunar Prospector - Polonium-210 Alpha Particle Count Rate
# Source    : polonium210.dat (PDS, version Jan. 3, 2002)
# Output    : polonium210_COG.tif
# CRS       : IAU:30100 (Moon 2015 / Ocentric)
# Units     : ²¹⁰Po counts/s (raw INT16 ÷ 1000)
# GDAL      : 3.12.2
# PROJ      : 9.8.0
# Python    : 3.12.13 (OSGeo4W)
# Requires  : GDAL >= 3.4, PROJ >= 8.1
# NOTE      : Binary values are 1000× the ASCII count rate values (unlike
#             most GRS products which are ×10). The data are mapped onto
#             336 equal-area pixels (~300 km × 450 km at equator); within
#             the 720×360 binary container each cell value is repeated
#             across all 0.5° pixels covering that cell.
# ============================================================

# Step 1 - Scale raw INT16 → Float32 counts/s
gdal_calc.py \
  -A polonium210.vrt \
  --outfile=polonium210_scaled.tif \
  --calc="A/1000.0" \
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
  polonium210_scaled.tif \
  polonium210_COG.tif

# Step 3 - Remove intermediate file
rm polonium210_scaled.tif

echo "Done → polonium210_COG.tif"
