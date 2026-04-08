#!/bin/bash
# ============================================================
# Lunar Prospector - Epithermal Neutron Counting Rate
# Source    : epis.dat (PDS, version Nov. 3, 2000)
# Output    : epithermal_COG.tif
# CRS       : IAU:30100 (Moon 2015 / Ocentric)
# Units     : counts/32s (raw INT16 ÷ 10)
# GDAL      : 3.12.2
# PROJ      : 9.8.0
# Python    : 3.12.13 (OSGeo4W)
# Requires  : GDAL >= 3.4, PROJ >= 8.1
# NOTE      : Counting rate from the Cd-covered ³He detector per 32 s,
#             corresponding to neutrons with energies 0.4–~100 eV. Binary
#             values are 10× the ASCII count rate values. Epithermal neutron
#             suppression is the primary hydrogen/water-ice proxy from LP NS -
#             hydrogen moderates fast neutrons to thermal energies, reducing
#             epithermal flux. Derived H abundance maps are available in the
#             LP GRS/NS 0.5° and 2° collections.
# ============================================================

# Step 1 - Scale raw INT16 → Float32 counts/32s
gdal_calc.py \
  -A epithermal.vrt \
  --outfile=epithermal_scaled.tif \
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
  epithermal_scaled.tif \
  epithermal_COG.tif

# Step 3 - Remove intermediate file
rm epithermal_scaled.tif

echo "Done → epithermal_COG.tif"
