#!/bin/bash
# Qiu et al. 2025 — Clementine CNN oxide maps
# Reassigns CRS to IAU:2015:30100 (Moon sphere) and converts to COG.
# Downloaded files are mislabeled as WGS 84 — coordinates are correct, datum is not.

set -e

for OXIDE in feo tio2 al2o3 mgo cao mg_number; do
    gdal_translate \
        -of COG \
        -a_srs "IAU:30100" \
        -a_ullr -180 90 180 -90 \
        -a_nodata -3.4028235e+38 \
        -co "COMPRESS=DEFLATE" \
        -co "PREDICTOR=3" \
        -co "BLOCKSIZE=512" \
        -co "BIGTIFF=YES" \
        -co "OVERVIEW_RESAMPLING=AVERAGE" \
        -co "OVERVIEWS=AUTO" \
        "${OXIDE}_clementine_cnn_qiu2025.tif" \
        "${OXIDE}_clementine_cnn_qiu2025_COG.tif"
done
