#!/usr/bin/env bash
# Generate COG GeoTIFFs from Kaguya SP gridded low-calcium pyroxene mosaics, north and south polar regions (Lemelin et al. 2022)
#
# Source files (Zenodo record 7108163, version 2, CC-BY-4.0), read in place from the zips:
#   gridded_low_calcium_pyroxene_mosaic_north_pole.tiff.zip
#   gridded_low_calcium_pyroxene_mosaic_south_pole.tiff.zip
#   Each holds a Float32 1-band GeoTIFF, 2529 x 2529 px, 1002.3503 m/px, block 2529x1
#   Values: weight fraction (0 to 1), no NoData value (0 is also the fill outside the mapped circle)
#   Georeferencing: no geotransform; four corner GCPs in the .tiff.aux.xml sidecar,
#   Moon_2000 polar stereographic (1737400 m sphere), row 0 at the -Y edge (bottom-up)
#   Download: https://zenodo.org/records/7108163
#
# Output : orthopyroxene_kaguya_sp_lemelin2022_north_pole_COG.tif (wt%, IAU:30130, north-up)
#          orthopyroxene_kaguya_sp_lemelin2022_south_pole_COG.tif (wt%, IAU:30135, north-up)
# GDAL   : 3.12.2
#
# The GCPs sit exactly on the raster corners (+/-1267472 m), so the bottom-up geotransform
# is assigned with -a_ullr. gdalwarp with nearest neighbor onto the same extent and size then
# flips the rows to north-up and leaves every pixel value unchanged. Warping through the GCP
# polynomial does not reproduce the source pixels on this grid.

set -euo pipefail

SRC_DIR="${1:-.}"
EXTENT=1267472
SIZE=2529

process_pole() {
  local pole="$1"
  local crs="$2"
  local name="gridded_low_calcium_pyroxene_mosaic_${pole}"
  local out="orthopyroxene_kaguya_sp_lemelin2022_${pole}_COG.tif"
  local vrt="orthopyroxene_${pole}_georef_tmp.vrt"
  local tmp="orthopyroxene_${pole}_wtpct_tmp.tif"

  echo "Source : ${SRC_DIR}/${name}.tiff.zip"
  echo "Output : $out"

  echo "Step 1/3: Assigning $crs and the bottom-up geotransform..."
  gdal_translate \
    -of VRT \
    -nogcp \
    -a_srs "$crs" \
    -a_ullr -$EXTENT -$EXTENT $EXTENT $EXTENT \
    "/vsizip/${SRC_DIR}/${name}.tiff.zip/${name}.tiff" "$vrt"

  echo "Step 2/3: Converting weight fraction to wt%..."
  gdal_calc.py \
    -A "$vrt" \
    --outfile="$tmp" \
    --calc="A * 100" \
    --type=Float32 \
    --hideNoData \
    --overwrite

  echo "Step 3/3: Flipping to north-up and converting to COG..."
  gdalwarp \
    -r near \
    -te -$EXTENT -$EXTENT $EXTENT $EXTENT \
    -ts $SIZE $SIZE \
    -of COG \
    -co COMPRESS=DEFLATE \
    -co PREDICTOR=3 \
    -co BLOCKSIZE=512 \
    -co OVERVIEW_RESAMPLING=AVERAGE \
    "$tmp" "$out"

  rm "$vrt" "$tmp"

  echo "Validating..."
  gdalinfo "$out" | grep -E "Driver|Size is|Origin|Pixel Size|Overviews|LAYOUT|COMPRESSION"
  echo "Done: $out"
}

process_pole north_pole IAU:30130
process_pole south_pole IAU:30135
