#!/bin/bash
# ============================================================
# LP GRS Compound & Elemental Abundance - Prettyman et al. 2006 - 20 deg
# Source    : lpgrs_high1_elem_abundance_20deg.tab (PDS LP-L-GRS-5-ELEM-ABUNDANCE-V1.0, created 2012-06-15)
# Output    : mgo/mgo_20d_prettyman2006_COG.tif, al2o3/al2o3_20d_..., sio2/sio2_20d_..., cao/cao_20d_...,
#             tio2/tio2_20d_..., feo/feo_20d_..., potassium/potassium_20d_..., thorium/thorium_20d_..., uranium/uranium_20d_...
# CRS       : IAU:30100 (Moon 2015 / Ocentric)
# Units     : oxides in wt% (source g/g x100), K/Th/U in ppm (source already ppm)
# Grid      : source pixels are quasi-equal-area. Latitude bands are 20 degrees tall, except the
#             two polar caps which are exactly 10 degrees tall. Each parameter is rasterized by WKT
#             polygon burn (gdal_rasterize) onto a fine 0.1x0.1 degree grid, then downsampled with
#             mode resampling to a 10x10 degree output grid (half the nominal band height), so every
#             latitude band boundary, including the polar caps, lands exactly on an output pixel
#             edge and each output pixel takes the value of whichever source bin covers most of its
#             area.
# GDAL      : 3.12.2
# PROJ      : 9.8.0
# Requires  : GDAL >= 3.4, PROJ >= 8.1
# ============================================================

set -e

# Step 1 - Convert the fixed-column ASCII table into a WKT polygon CSV (one row per equal-area pixel)
awk '
BEGIN { print "id,WKT,mgo,al2o3,sio2,cao,tio2,feo,potassium,thorium,uranium" }
{
  minlat=$2; maxlat=$3; minlon=$4; maxlon=$5
  wkt = "\"POLYGON ((" minlon " " minlat ", " maxlon " " minlat ", " maxlon " " maxlat ", " minlon " " maxlat ", " minlon " " minlat "))\""
  printf "%s,%s,%.6f,%.6f,%.6f,%.6f,%.6f,%.6f,%.4f,%.4f,%.4f\n", $1, wkt, $8*100, $9*100, $10*100, $11*100, $12*100, $13*100, $14, $15, $16
}
' lpgrs_high1_elem_abundance_20deg.tab > lpgrs_20deg_prettyman2006.csv

# Step 2 - Wrap the CSV as an OGR vector layer (WKT geometry field, IAU:30100)
cat > lpgrs_20deg_prettyman2006.vrt <<'EOF'
<OGRVRTDataSource>
  <OGRVRTLayer name="lpgrs_20deg_prettyman2006">
    <SrcDataSource>lpgrs_20deg_prettyman2006.csv</SrcDataSource>
    <SrcLayer>lpgrs_20deg_prettyman2006</SrcLayer>
    <GeometryType>wkbPolygon</GeometryType>
    <LayerSRS>IAU:30100</LayerSRS>
    <GeometryField encoding="WKT" field="WKT"/>
    <Field name="mgo" type="Real" src="mgo"/>
    <Field name="al2o3" type="Real" src="al2o3"/>
    <Field name="sio2" type="Real" src="sio2"/>
    <Field name="cao" type="Real" src="cao"/>
    <Field name="tio2" type="Real" src="tio2"/>
    <Field name="feo" type="Real" src="feo"/>
    <Field name="potassium" type="Real" src="potassium"/>
    <Field name="thorium" type="Real" src="thorium"/>
    <Field name="uranium" type="Real" src="uranium"/>
  </OGRVRTLayer>
</OGRVRTDataSource>
EOF

# Step 3 - Rasterize each parameter onto a fine grid, downsample to a 10x10 degree grid (half
# the 20 degree nominal band height, so the 10 degree polar caps align exactly) with mode
# resampling, then write as COG
for PARAM in mgo al2o3 sio2 cao tio2 feo potassium thorium uranium; do
  gdal_rasterize \
    -a "$PARAM" \
    -te -180 -90 180 90 \
    -tr 0.1 0.1 \
    -ot Float32 \
    -init -9999 \
    -a_nodata -9999 \
    -a_srs IAU:30100 \
    lpgrs_20deg_prettyman2006.vrt \
    "${PARAM}_fine.tif"

  gdal_translate \
    -tr 10 10 \
    -r mode \
    -a_nodata -9999 \
    "${PARAM}_fine.tif" \
    "${PARAM}_raw.tif"

  gdal_translate \
    -of COG \
    -a_ullr -180 90 180 -90 \
    -co "COMPRESS=DEFLATE" \
    -co "PREDICTOR=3" \
    -co "BLOCKSIZE=256" \
    -co "OVERVIEW_RESAMPLING=AVERAGE" \
    -co "OVERVIEWS=AUTO" \
    "${PARAM}_raw.tif" \
    "${PARAM}/${PARAM}_20d_prettyman2006_COG.tif"

  rm "${PARAM}_fine.tif" "${PARAM}_raw.tif"
done

echo "Done -> 9 COGs written under ./{mgo,al2o3,sio2,cao,tio2,feo,potassium,thorium,uranium}/"
