#!/usr/bin/env bash
# Convert IAU Moon nomenclature shapefile to a compact JSON array for Cesium
# label rendering.
#
# Source: MOON_nomenclature_center_pts.shp
#
# Output: iau_nomenclature_compact.json
#   Format: [[name, lon, lat, diameter], ...] sorted by diameter descending.
#   Only the four fields the label renderer needs are kept.
#   Longitude is normalised to -180..180.
#   IAU-approved features only (approval = "Adopted by IAU").
#
# Requirements: GDAL >= 3.1 with SQLite dialect, Python 3
#
# Usage: bash build_compact.sh [input.shp]

set -euo pipefail

SRC="${1:-MOON_nomenclature_center_pts.shp}"
OUT="iau_nomenclature_compact.json"
TEMP="_build_compact_temp.geojson"

echo "Source : $SRC"
echo "Output : $OUT"

# Cleanup temp file on exit (success or error)
trap 'rm -f "$TEMP"' EXIT

echo "Step 1/2: Extracting fields from shapefile..."
ogr2ogr \
  -f GeoJSON \
  -a_srs "IAU:30100" \
  -dialect SQLite \
  -sql "SELECT
    MakePoint(
      CASE WHEN ST_X(geometry) > 180 THEN ST_X(geometry) - 360 ELSE ST_X(geometry) END,
      ST_Y(geometry)
    ) AS geometry,
    name,
    diameter
  FROM MOON_nomenclature_center_pts
  WHERE approval = 'Adopted by IAU'" \
  "$TEMP" \
  "$SRC"

echo "Step 2/2: Building compact JSON array..."
python3 - "$TEMP" "$OUT" << 'EOF'
import json
import sys

src, out = sys.argv[1], sys.argv[2]

with open(src, encoding="utf-8") as f:
    data = json.load(f)

rows = []
for feat in data["features"]:
    geom = feat.get("geometry")
    props = feat.get("properties") or {}
    name = props.get("name") or ""
    diameter = props.get("diameter") or 0
    if not geom or not name:
        continue
    lon = geom["coordinates"][0]
    lat = geom["coordinates"][1]
    rows.append([name, lon, lat, diameter])

rows.sort(key=lambda r: -(r[3] or 0))

with open(out, "w", encoding="utf-8") as f:
    json.dump(rows, f, separators=(",", ":"), ensure_ascii=False)

print(f"Written {len(rows)} features to {out}")
EOF

echo "Done: $OUT"
