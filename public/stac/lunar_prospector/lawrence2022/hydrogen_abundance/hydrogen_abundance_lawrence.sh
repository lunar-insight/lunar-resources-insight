#!/bin/bash
# ============================================================
# Lunar Prospector – Global Hydrogen Abundance Map (ppm)
# Source    : figure6.txt (JHU-APL data repository)
# Reference : Lawrence et al. 2022, JGR Planets, doi:10.1029/2022JE007197
# Output    : hydrogen_abundance_lawrence_COG.tif
# CRS       : IAU:30100 (Moon 2015 / Ocentric)
# Units     : ppm H by weight (Float32)
# Grid      : 720 × 360 equal-angle rectangular, full Moon, 0.5°/pixel
# Pixel     : 0.5° (~15.2 km at equator)
# Requires  : GDAL >= 3.4, Python 3
# ============================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SRC_TXT="$SCRIPT_DIR/figure6.txt"
TMP_ASC="$SCRIPT_DIR/hydrogen_abundance_lawrence_tmp.asc"
OUT_COG="$SCRIPT_DIR/hydrogen_abundance_lawrence_COG.tif"

# ── Step 1 – Parse (MAPLON, MAPLAT, HMAP) triplets and write AAIGrid ─────────
# Source is south→north, west→east. We sort north→south for a north-up GeoTIFF.
python3 -c "
import sys

src = '$SRC_TXT'
out = '$TMP_ASC'

data = []
with open(src) as f:
    for line in f:
        if line.startswith('#') or not line.strip():
            continue
        parts = line.split()
        if len(parts) < 3:
            continue
        data.append((float(parts[0]), float(parts[1]), float(parts[2])))

# Sort north→south, then west→east
data.sort(key=lambda x: (-x[1], x[0]))
values = [d[2] for d in data]

expected = 720 * 360
if len(values) != expected:
    print(f'ERROR: expected {expected} values, got {len(values)}', file=sys.stderr)
    sys.exit(1)

hdr = 'ncols        720\nnrows        360\nxllcorner    -180\nyllcorner    -90\ncellsize     0.5\nNODATA_value -9999\n'
with open(out, 'w') as f:
    f.write(hdr)
    for i in range(360):
        row = values[i*720:(i+1)*720]
        f.write(' '.join(f'{v:.6f}' for v in row) + '\n')
print(f'Written {len(values)} values to {out}')
"

# ── Step 2 – AAIGrid → Cloud Optimised GeoTIFF ──────────────────────────────
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

# ── Step 3 – Remove intermediate file ───────────────────────────────────────
rm "$TMP_ASC"

echo "Done → $OUT_COG"
