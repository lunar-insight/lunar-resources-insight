#!/bin/bash
# ============================================================
# Chandrayaan-2 CLASS - L2 Elemental Abundance Map, Sodium
# Source    : ch2_cla_l2_map_na_v1.tif/.xml (PDS4, ISRO ISDA/PRADAN)
# Output    : sodium_ch2_class_COG.tif
# CRS       : IAU:30100 (Moon 2015 / Ocentric)
# Units     : Na wt% (Float32)
# Grid      : 1000 x 2000, 150 km along-track x 12.5 km across-track ground pixel, sparse ground-track coverage
# GDAL      : 3.12.2
# Requires  : GDAL >= 3.4
# ============================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SRC_TIF="$SCRIPT_DIR/ch2_cla_l2_map_na_v1.tif"
OUT_COG="$SCRIPT_DIR/sodium_ch2_class_COG.tif"

# Reassign CRS to IAU:30100 (degrees; same sphere and grid as the source WGS84 tag) and write COG
gdal_translate \
  -of COG \
  -a_srs IAU:30100 \
  -a_ullr -178.141998 86.849100 179.852005 -86.352303 \
  -a_nodata 0 \
  -co "COMPRESS=DEFLATE" \
  -co "PREDICTOR=3" \
  -co "BLOCKSIZE=256" \
  -co "OVERVIEW_RESAMPLING=AVERAGE" \
  -co "OVERVIEWS=AUTO" \
  "$SRC_TIF" \
  "$OUT_COG"

echo "Done -> $OUT_COG"
