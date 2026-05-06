#!/bin/bash
# ============================================================
# Lunar Prospector - Gadolinium 2°
# Source    : ../samarium/samarium2d_COG.tif (lp-samarium-2deg)
# Output    : gadolinium2d_COG.tif
# CRS       : IAU:30100 (Moon 2015 / Ocentric)
# Units     : Gd ug/g  (Sm ug/g × 1.17)
# Method    : Gd/Sm = 1.17 — mean ratio from Apollo mafic impact melt breccias
#             (Korotev 2000, DOI:10.1029/1999JE001063)
#             Gd and Sm are co-derived from LP NS excess absorption AΣeff;
#             the ratio is the only constraint that separates them
#             (Elphic et al. 2000, DOI:10.1029/1999JE001176)
# GDAL      : 3.12.2
# PROJ      : 9.8.0
# Python    : 3.12.13 (OSGeo4W)
# Requires  : GDAL >= 3.4, PROJ >= 8.1
# ============================================================

# Step 1 - Derive Gd ug/g = Sm ug/g × 1.17; propagate NoData (-9999) unchanged
gdal_calc.py \
  -A ../samarium/samarium2d_COG.tif \
  --outfile=gadolinium_scaled.tif \
  --calc="where(A == -9999, -9999, A * 1.17)" \
  --type=Float32 \
  --NoDataValue=-9999 \
  --overwrite

# Step 2 - Write Cloud Optimised GeoTIFF (inherits georeferencing from Sm COG)
gdal_translate \
  -of COG \
  -a_ullr -180 90 180 -90 \
  -co "COMPRESS=DEFLATE" \
  -co "PREDICTOR=3" \
  -co "BLOCKSIZE=256" \
  -co "OVERVIEW_RESAMPLING=AVERAGE" \
  -co "OVERVIEWS=AUTO" \
  gadolinium_scaled.tif \
  gadolinium2d_COG.tif

# Step 3 - Remove intermediate file
rm gadolinium_scaled.tif

echo "Done → gadolinium2d_COG.tif"
