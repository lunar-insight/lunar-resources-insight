#!/bin/bash
# ============================================================
# Lunar Prospector – Sn-Covered Sensor Pixon Reconstruction
# Source    : jgre20969-sup-0004-supplementary.txt (Dataset S3)
# Reference : Wilson et al. 2018, JGR Planets, doi:10.1029/2018JE005589
# Output    : sn_thermal_epithermal_wilson_COG.tif
# CRS       : IAU:30100 (Moon 2015 / Ocentric)
# Units     : counts/32s (Float32) – blended thermal + epithermal signal
# Grid      : 1024 × 512 equal-angle rectangular, full Moon (source: 1024 lon-bins × 512 lat-bins, column-major)
# Pixel     : 0.3515625° (~10.7 km at equator, 38 km effective resolution)
# GDAL      : 3.12.2
# PROJ      : 9.8.0
# Python    : 3.12.13 (OSGeo4W)
# Requires  : GDAL >= 3.4, PROJ >= 8.1
# ============================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SRC_TXT="$SCRIPT_DIR/jgre20969-sup-0004-supplementary.txt"
TMP_ASC="$SCRIPT_DIR/sn_thermal_epithermal_wilson_tmp.asc"
OUT_COG="$SCRIPT_DIR/sn_thermal_epithermal_wilson_COG.tif"

# ── Step 1 – Validate value count ───────────────────────────────────────────
COUNT=$(grep -v '^#' "$SRC_TXT" | wc -w)
[ "$COUNT" -eq 524288 ] || { echo "ERROR: expected 524288 values, got $COUNT"; exit 1; }

# ── Step 2 – Transpose and write AAIGrid ────────────────────────────────────
# Dataset S3 is stored column-major: 1024 lines = longitude bins (-180→+180),
# 512 values per line = latitude bins (north→south, col 0 = +90°, col 511 = -90°).
# Steps: transpose to (lat-rows × lon-cols). No V-flip or H-roll needed.
python3 -c "
src='$SRC_TXT'; out='$TMP_ASC'
with open(src) as f:
    words = [w for l in f if not l.startswith('#') for w in l.split()]
# Read as 1024 lon-rows x 512 lat-cols
lon_rows = [words[i*512:(i+1)*512] for i in range(1024)]
# Transpose → 512 lat-rows x 1024 lon-cols (row 0 = lat +90°, already north-up)
lat_rows = [[lon_rows[j][i] for j in range(1024)] for i in range(512)]
hdr = 'ncols        1024\nnrows        512\nxllcorner    -180\nyllcorner    -90\ncellsize     0.3515625\nNODATA_value -9999\n'
with open(out, 'w') as f:
    f.write(hdr)
    for r in lat_rows:
        f.write(' '.join(r) + '\n')
"

# ── Step 3 – AAIGrid → Cloud Optimised GeoTIFF ──────────────────────────────
# -a_srs  : assign IAU:30100 (Moon 2015 / Ocentric)
# -a_ullr : north-up orientation (UL=-180,90  LR=180,-90)
#           pixel data has already been transposed (north-up) in Step 2
gdal_translate \
  -of COG \
  -a_srs IAU:30100 \
  -a_ullr -180 90 180 -90 \
  -co "COMPRESS=DEFLATE" \
  -co "PREDICTOR=3" \
  -co "BLOCKSIZE=256" \
  -co "OVERVIEW_RESAMPLING=AVERAGE" \
  -co "OVERVIEWS=AUTO" \
  "$TMP_ASC" "$OUT_COG"

# ── Step 4 – Remove intermediate file ───────────────────────────────────────
rm "$TMP_ASC"

echo "Done → $OUT_COG"
