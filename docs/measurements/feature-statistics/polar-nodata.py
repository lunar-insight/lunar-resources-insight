# Checks the Kaguya SP polar mineral files for a nodata value or mask, and
# counts the zeros they hold. Each file is a square around a circular map, so
# unmasked corners read as zero abundance.
#
# Runs inside the tiler container, which has rasterio and the /data mount:
#
#   docker exec -i planetcantile-planetcantile-1 python - \
#     < docs/measurements/feature-statistics/polar-nodata.py

import glob

import numpy as np
import rasterio

# Share of a square outside its inscribed circle.
CORNERS = 1 - np.pi / 4

print(f"corner share of a square: {CORNERS * 100:.1f}%")
for path in sorted(glob.glob("/data/minerals/*/*_sp_*COG.tif")):
    with rasterio.open(path) as src:
        values = src.read(1, out_shape=(632, 632))
        masks = src.read_masks(1, out_shape=(632, 632))
        corner = np.unique(values[:40, :40])
        print(
            f"{path.split('/')[-1]:<60} nodata {src.nodata}"
            f"  masked {(masks == 0).mean() * 100:.1f}%"
            f"  zeros {(values == 0).mean() * 100:.1f}%"
            f"  corner values {corner[:3]}"
        )
