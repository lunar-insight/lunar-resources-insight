#!/usr/bin/env bash
# Generate COG GeoTIFF from Kaguya MI Derived Orthopyroxene Weight Percent 50N50S 512ppd 59mpp (Lemelin et al. 2016)
#
# Source file: Lunar_Kaguya_MIMap_MineralDeconv_OrthopyroxenePercent_50N50S.tif
#   37.7 GB, Float32, 1-band, 184320 x 51200 px, uncompressed, block 184320x1 (scanline strips)
#   Values: weight fraction (0 to 1), NoData = -3.4028227e+38
#   CRS: geographic GCS_Moon_2000, 1737400 m sphere, origin (-180, 50), 0.001953125 deg/px (512 ppd)
#   Download: https://astrogeology.usgs.gov/search/map/kaguya_lunar_multiband_imager_mi_derived_orthopyroxene_weight_percent_50n50s_512ppd_59mpp
#
# Output : orthopyroxene_kaguya_mi_lemelin2016_COG.tif (wt%, NoData = -9999, IAU:30100)
# GDAL   : 3.12.2
#
# The source grid is geographic degrees on the IAU sphere, so IAU:30100 is assigned
# with -a_srs and no pixel is resampled.

set -euo pipefail

SRC="${1:-Lunar_Kaguya_MIMap_MineralDeconv_OrthopyroxenePercent_50N50S.tif}"
OUT="orthopyroxene_kaguya_mi_lemelin2016_COG.tif"
TMP="orthopyroxene_kaguya_mi_lemelin2016_wtpct_tmp.tif"

echo "Source : $SRC"
echo "Output : $OUT"

echo "Step 1/2: Converting weight fraction to wt%..."
# numpy.where keeps NoData out of the multiplication: -3.4e38 x 100 overflows Float32
# and gdal_calc.py then writes NaN in place of the output NoData value.
gdal_calc.py \
  -A "$SRC" \
  --outfile="$TMP" \
  --calc="numpy.where(A < -1e37, -9999, A * 100)" \
  --type=Float32 \
  --NoDataValue=-9999 \
  --co BIGTIFF=YES \
  --co TILED=YES \
  --co COMPRESS=DEFLATE \
  --co PREDICTOR=3 \
  --co NUM_THREADS=ALL_CPUS \
  --overwrite

echo "Step 2/2: Assigning IAU:30100 and converting to COG..."
gdal_translate \
  -of COG \
  -a_srs IAU:30100 \
  -co COMPRESS=DEFLATE \
  -co PREDICTOR=3 \
  -co BLOCKSIZE=512 \
  -co OVERVIEW_RESAMPLING=AVERAGE \
  -co BIGTIFF=YES \
  -co NUM_THREADS=ALL_CPUS \
  "$TMP" "$OUT"

rm "$TMP"

echo "Validating..."
gdalinfo "$OUT" | grep -E "Driver|Size is|Block|Overviews|NoData|LAYOUT|COMPRESSION"
echo "Done: $OUT"
