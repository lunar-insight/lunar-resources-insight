#!/bin/bash
# ============================================================
# Lunar Prospector – Th-line GRS Pixon Reconstruction
# Source    : jgre20969-sup-0005-supplementary.txt (Dataset S4)
# Reference : Wilson et al. 2018, JGR Planets, doi:10.1029/2018JE005589
# Output    : thorium_grs_wilson_COG.tif
# CRS       : IAU:30100 (Moon 2015 / Ocentric)
# Units     : count rate – Th 2.61 MeV line excess over 2.5–2.7 MeV background
# Grid      : 1024 × 512 equal-angle rectangular, full Moon
# Pixel     : 0.3515625° (~10.7 km at equator, 26 km effective resolution)
# GDAL      : 3.12.2
# PROJ      : 9.8.0
# Python    : 3.12.13 (OSGeo4W)
# Requires  : GDAL >= 3.4, PROJ >= 8.1
# ============================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SRC_TXT="$SCRIPT_DIR/jgre20969-sup-0005-supplementary.txt"
TMP_ASC="$SCRIPT_DIR/thorium_grs_wilson_tmp.asc"
OUT_COG="$SCRIPT_DIR/thorium_grs_wilson_COG.tif"

# ── Step 1 – Validate value count ───────────────────────────────────────────
COUNT=$(grep -v '^#' "$SRC_TXT" | wc -w)
[ "$COUNT" -eq 524288 ] || { echo "ERROR: expected 524288 values, got $COUNT"; exit 1; }

# ── Step 2 – Prepend AAIGrid header, strip comments, and roll longitude ──────
# The Wilson 2018 source data is stored north→south / 0°→360° longitude.
# No V flip is needed (row 0 is already the north pole).
# H roll by 512 shifts longitude from 0→360° storage to -180→180° convention.
python3 -c "
src='$SRC_TXT'; out='$TMP_ASC'
with open(src) as f:
    words = [w for l in f if not l.startswith('#') for w in l.split()]
rows = [words[i*1024:(i+1)*1024] for i in range(512)]
rows = [r[512:] + r[:512] for r in rows]  # H roll +180: lon 0-360 stored -> -180-180
hdr = 'ncols        1024\nnrows        512\nxllcorner    -180\nyllcorner    -90\ncellsize     0.3515625\nNODATA_value -9999\n'
with open(out, 'w') as f:
    f.write(hdr)
    for r in rows:
        f.write(' '.join(r) + '\n')
"

# ── Step 3 – AAIGrid → Cloud Optimised GeoTIFF ──────────────────────────────
# -a_srs  : assign IAU:30100 (Moon 2015 / Ocentric)
# -a_ullr : north-up orientation (UL=-180,90  LR=180,-90)
#           pixel data is already north-up; Step 2 only rolls longitude
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
