#!/bin/bash
# ============================================================
# Kaguya (SELENE) - GRS Nuclide Map, Uranium
# Source    : GRS_NMAP_U_071214_081216.img/.lbl (PDS3, JAXA DARTS, SLN-L-GRS-5-NUCLIDE-MAP-V1.0)
# Output    : uranium_nmap_COG.tif
# CRS       : IAU:30100 (Moon 2015 / Ocentric)
# Units     : U ppm (raw UInt16 x scaling_factor - offset, per label COMMENT_TEXT)
#             Global mean 0.52 ppm, of the same order as the ~0.3 ppm average and ~2 ppm
#             maximum reported by Kobayashi/Yamashita et al. for Kaguya GRS uranium. Values
#             are floored at 0 to remove small negative artifacts from background subtraction.
# GDAL      : 3.12.2
# PROJ      : 9.8.0 (bundled with GDAL 3.12.2)
# Requires  : GDAL >= 3.4 with PDS driver (reads .lbl/.img detached pair directly, no VRT needed)
# ============================================================

# Step 1 - Apply label scaling formula (raw x scaling_factor - offset), floor at 0 -> Float32 U ppm
gdal_calc.py \
  -A GRS_NMAP_U_071214_081216.lbl \
  --outfile=uranium_scaled.tif \
  --calc="numpy.maximum(A*0.001 - 1.0, 0)" \
  --type=Float32 \
  --NoDataValue=-9999 \
  --overwrite

# Step 2 - Reassign CRS to IAU:30100 (degrees; same sphere and grid as the source projected CRS) and write COG
gdal_translate \
  -of COG \
  -a_srs IAU:30100 \
  -a_ullr -180 90 180 -90 \
  -co "COMPRESS=DEFLATE" \
  -co "PREDICTOR=3" \
  -co "BLOCKSIZE=256" \
  -co "OVERVIEW_RESAMPLING=AVERAGE" \
  -co "OVERVIEWS=AUTO" \
  uranium_scaled.tif \
  uranium_nmap_COG.tif

# Step 3 - Remove intermediate file
rm uranium_scaled.tif

echo "Done -> uranium_nmap_COG.tif"
