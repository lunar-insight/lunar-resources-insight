#!/bin/bash
# ============================================================
# Lunar Prospector - Thermal Neutron Counting Rate
# Source    : therms.dat (PDS, version Nov. 3, 2000)
# Output    : thermal_COG.tif
# CRS       : IAU:30100 (Moon 2015 / Ocentric)
# Units     : counts/32s (raw INT16 ÷ 10)
# GDAL      : 3.12.2
# PROJ      : 9.8.0
# Python    : 3.12.13 (OSGeo4W)
# Requires  : GDAL >= 3.4, PROJ >= 8.1
# NOTE      : Counting rate is the difference between the Sn and Cd-covered
#             ³He detector rates per 32 s, corresponding to neutrons with
#             energies 0–0.4 eV. Binary values are 10× the ASCII count rate
#             values. Thermal suppression is sensitive to hydrogen AND to other
#             neutron absorbers (Fe, Ti, Gd, Sm, Cl) - cross-reference with
#             epithermal map and GRS Fe/Ti maps to isolate hydrogen signal.
# ============================================================

# Step 1 - Scale raw INT16 → Float32 counts/32s
gdal_calc.py \
  -A thermal.vrt \
  --outfile=thermal_scaled.tif \
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
  thermal_scaled.tif \
  thermal_COG.tif

# Step 3 - Remove intermediate file
rm thermal_scaled.tif

echo "Done → thermal_COG.tif"
