#!/usr/bin/env bash
# Convert IAU Planetary Nomenclature (Moon) shapefile to GeoJSON for the layer service.
#
# Source: MOON_nomenclature_center_pts.shp
#   CRS: GCS_Moon_2000 (geographic, degrees, 0-360 East longitude)
#   ~1690 point features (IAU-approved named features on the Moon)
#   Download: https://planetarynames.wr.usgs.gov/
#
# Output: iau_nomenclature_moon.geojson
#   - Geometry longitude normalised from 0-360 to -180 to 180 (GeoJSON spec, Cesium-compatible)
#   - CENTER_LON attribute kept as 0-360 (project display convention)
#   - Only IAU-adopted names retained (APPROVAL = 5)
#   - Low-value columns dropped (extent bounds, ethnicity, quad codes)
#
# Requirements: GDAL >= 3.1 with SQLite dialect support
#   Run from the OSGeo4W shell or ensure GDAL is on PATH.
#   On this machine: D:\QGIS 3.44.8\bin\ogr2ogr.exe
#
# Usage: bash process_nomenclature.sh [input.shp]

set -euo pipefail

SRC="${1:-MOON_nomenclature_center_pts.shp}"
OUT="iau_nomenclature_moon.geojson"

echo "Source : $SRC"
echo "Output : $OUT"

echo "Step 1/2: Inspecting source..."
ogrinfo -al -so "$SRC"

echo "Step 2/2: Converting to GeoJSON..."
ogr2ogr \
  -f GeoJSON \
  -a_srs "IAU:30100" \
  -dialect SQLite \
  -sql "SELECT
    MakePoint(
      CASE WHEN ST_X(geometry) > 180 THEN ST_X(geometry) - 360 ELSE ST_X(geometry) END,
      ST_Y(geometry)
    ) AS geometry,
    FEATURE,
    CLEAN_FEAT,
    TYPE,
    DIAMETER,
    CENTER_LON,
    CENTER_LAT,
    APPROVAL,
    APPROVALDT,
    ORIGIN,
    LINK
  FROM MOON_nomenclature_center_pts
  WHERE approval = 'Adopted by IAU'" \
  "$OUT" \
  "$SRC"

echo "Validating..."
ogrinfo -al -so "$OUT"
echo "Done: $OUT"
echo ""
echo "Copy $OUT to the layer service under: nomenclature/iau_nomenclature_moon.geojson"
