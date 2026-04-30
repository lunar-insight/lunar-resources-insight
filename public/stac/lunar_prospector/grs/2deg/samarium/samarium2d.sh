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
# Requires  : GDAL >= 3.4, PROJ >= 8.1
# ============================================================

# Step 1 - Scale raw INT16 → Float32 Sm ug/g; mask clamped noise-floor sentinel (raw -40)
# Values -39 to -1 are valid GRS counting noise and are kept as-is.
gdal_calc.py \
  -A samarium2d.vrt \
  --outfile=samarium_scaled.tif \
  --calc="where(A == -40, -9999, A/10.0)" \
  --type=Float32 \
  --NoDataValue=-9999 \
  --overwrite

# Step 2 - Mask polar caps (rows 0-37 = lat >+71°, rows 322-359 = lat <-71°)
# These rows are all-zero in the source binary: no LP GRS coverage, not measured zero abundance.
python3 -c "
from osgeo import gdal
import numpy as np
ds = gdal.Open('samarium_scaled.tif', gdal.GA_Update)
band = ds.GetRasterBand(1)
arr = band.ReadAsArray()
arr[:38, :] = -9999
arr[322:, :] = -9999
band.WriteArray(arr)
band.SetNoDataValue(-9999)
ds = None
"

# Step 3 - Write Cloud Optimised GeoTIFF (VRT reads rows in reverse → already north-up)
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

# Step 4 - Remove intermediate file
rm samarium_scaled.tif

echo "Done → samarium2d_COG.tif"
