#!/bin/bash
# ============================================================
# Kaguya (SELENE) - GRS Nuclide Map, Calcium
# Source    : GRS_NMAP_Ca_090210_090527.img/.lbl (PDS3, JAXA DARTS, SLN-L-GRS-5-NUCLIDE-MAP-V1.0)
# Output    : calcium_nmap_COG.tif
# CRS       : IAU:30100 (Moon 2015 / Ocentric)
# Units     : CaO wt% (raw UInt16 x scaling_factor - offset, per label COMMENT_TEXT)
# GDAL      : 3.12.2
# PROJ      : 9.8.0 (bundled with GDAL 3.12.2)
# Requires  : GDAL >= 3.4 with PDS driver (reads .lbl/.img detached pair directly, no VRT needed)
# ============================================================

# Step 1 - Apply label scaling formula (raw x scaling_factor - offset) -> Float32 CaO wt%
gdal_calc.py \
  -A GRS_NMAP_Ca_090210_090527.lbl \
  --outfile=calcium_scaled.tif \
  --calc="A*0.01 - 0" \
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
  calcium_scaled.tif \
  calcium_nmap_COG.tif

# Step 3 - Remove intermediate file
rm calcium_scaled.tif

echo "Done -> calcium_nmap_COG.tif"
