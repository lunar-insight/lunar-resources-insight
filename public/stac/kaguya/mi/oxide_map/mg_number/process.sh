#!/usr/bin/env bash
# Generate COG GeoTIFF from Mg# Magnesium Number, Kaguya MI 65N-65S (Shi et al. 2026)
#
# Source files: Mg#_batch1.tif to Mg#_batch9.tif, Figshare doi:10.6084/m9.figshare.30022171
#   9 files, Float32, 1-band, 20480 x 66560 px each, LZW, 128 x 128 tiles
#   Batch n covers longitude -180 + 40 (n - 1) to -140 + 40 (n - 1), 65N to 65S
#   Values: 0 to 100, 100 x molar Mg/(Mg + Fe); NoData = 3.4e38 (float32)
#   CRS: geographic GCS_Moon_2000, 1737400 m sphere, 0.001953125 deg/px (512 ppd)
#
# Output : mg_number_kaguya_mi_shi2026_COG.tif (Mg# 0 to 100, NoData = -9999, IAU:30100), 184320 x 66560 px
# GDAL   : 3.12.2
#
# The batches share one grid and tile exactly, so the VRT joins them without resampling,
# and IAU:30100 is assigned with -a_srs. NoData is tested as > 1e38: the source value is
# 3.4e38 as float32, which the double 3.4e38 does not equal.
#
# Mg# is set to NoData where MgO is NoData. There the published Mg# rests on MgO values
# outside 1 to 12 wt%, which the MgO map sets to NoData (0.566% of valid Mg# pixels).
#
# Batches 2 and 3 each appear twice on Figshare with identical content (file ids 57576748
# and 57590671, 57578134 and 57591262). The first file matching *Mg#_batch{n}.tif is used,
# so copies saved as {file id}_Mg#_batch{n}.tif also work. SRC_DIR also holds the MgO
# batches (MgO batches 2 and 3: doi:10.6084/m9.figshare.31044286).

set -euo pipefail

SRC_DIR="${1:-.}"
NAME="mg_number_kaguya_mi_shi2026"
OUT="${NAME}_COG.tif"
VRT="${NAME}_tmp.vrt"
VRT_MGO="${NAME}_mgo_tmp.vrt"
TMP="${NAME}_tmp.tif"

FILES=()
FILES_MGO=()
for n in 1 2 3 4 5 6 7 8 9; do
  match=""
  for f in "$SRC_DIR"/*"Mg#_batch$n.tif"; do
    [ -f "$f" ] && { match="$f"; break; }
  done
  [ -n "$match" ] || { echo "Missing Mg# batch $n in $SRC_DIR" >&2; exit 1; }
  FILES+=("$match")
  FILES_MGO+=("$SRC_DIR/MgO_batch$n.tif")
done

echo "Source : $SRC_DIR/*Mg#_batch[1-9].tif, MgO_batch[1-9].tif"
echo "Output : $OUT"

echo "Step 1/3: Joining the 9 batches of Mg# and of MgO..."
gdalbuildvrt "$VRT" "${FILES[@]}"
gdalbuildvrt "$VRT_MGO" "${FILES_MGO[@]}"

echo "Step 2/3: Mapping NoData to -9999 and masking Mg# where MgO is NoData..."
gdal_calc.py \
  -A "$VRT" \
  -B "$VRT_MGO" \
  --outfile="$TMP" \
  --calc="numpy.where((A > 1e38) | (B > 1e38), -9999, A)" \
  --type=Float32 \
  --NoDataValue=-9999 \
  --co BIGTIFF=YES \
  --co TILED=YES \
  --co COMPRESS=DEFLATE \
  --co PREDICTOR=3 \
  --co NUM_THREADS=ALL_CPUS \
  --overwrite

echo "Step 3/3: Assigning IAU:30100 and converting to COG..."
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

rm "$TMP" "$VRT" "$VRT_MGO"

echo "Validating..."
gdalinfo "$OUT" | grep -E "Driver|Size is|Block|Overviews|NoData|LAYOUT|COMPRESSION"
echo "Done: $OUT"
