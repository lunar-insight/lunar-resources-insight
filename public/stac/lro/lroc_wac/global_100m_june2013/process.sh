#!/usr/bin/env bash
# Generate COG GeoTIFF from LRO LROC WAC Global Morphology Mosaic 100m (June 2013, v3)
#
# Source file: Lunar_LRO_LROC-WAC_Mosaic_global_100m_June2013.tif
#   5.5 GB, UInt8, 1-band (643 nm), 109164 x 54582 px, nodata=0
#   CRS: PROJCRS["SimpleCylindrical MOON"] — Equidistant Cylindrical, D_MOON sphere (1737400 m), metres
#   Block: 109164x1 (scanline strips, COG conversion required for tiled access)
#   Download: https://astrogeology.usgs.gov/search/map/moon_lro_lroc_wac_global_morphology_mosaic_100m
#
# Requirements: GDAL >= 3.1
#
# Two-step approach: warp first (no NoData conflict), then convert to COG.
# Direct gdalwarp -of COG with dstnodata=0 remaps valid dark pixels (value=0)
# to 1 because 0 is also the source NoData value. Splitting the steps avoids this.

set -euo pipefail

SRC="${1:-Lunar_LRO_LROC-WAC_Mosaic_global_100m_June2013.tif}"
OUT="lro_lroc_wac_global_100m_june2013_COG.tif"
TMP="lro_lroc_wac_global_100m_june2013_warp_tmp.tif"

echo "Source : $SRC"
echo "Output : $OUT"

echo "Step 1/2: Reprojecting to IAU:30100..."
gdalwarp \
  -t_srs "IAU:30100" \
  -r lanczos \
  -srcnodata none \
  -co BIGTIFF=YES \
  "$SRC" "$TMP"

echo "Step 2/2: Converting to COG..."
gdal_translate \
  -of COG \
  -co COMPRESS=DEFLATE \
  -co PREDICTOR=2 \
  -co BLOCKSIZE=512 \
  -co OVERVIEW_RESAMPLING=LANCZOS \
  -co BIGTIFF=YES \
  "$TMP" "$OUT"

rm "$TMP"

echo "Validating..."
gdalinfo "$OUT" | grep -E "Driver|Block|Overviews|Compression"
echo "Done: $OUT"
