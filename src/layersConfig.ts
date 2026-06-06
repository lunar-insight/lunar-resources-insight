import type { LayersConfig } from './types/layers';

export const layersConfig: LayersConfig = {
  layers: {
    /*
      -------
      Basemap
      -------
    */
    lroc_wac_basemap: {
      filename: "basemap/lro_lroc_wac_global_100m_june2013_COG.tif",
      category: "basemap",
      displayName: "LRO LROC WAC Global Mosaic (100m, June 2013)",
      stac: "lro/lroc_wac/global_100m_june2013/lro_lroc_wac_global_100m_june2013.json",
      metadata: {
        source: "LRO LROC / ASU",
        resolution: "100m/pixel",
        description: "8-bit grayscale global lunar morphology mosaic, WAC 643 nm"
      }
    },
    /*
      ------------------
      Geographical layer
      ------------------
    */
    geological_global: {
      filename: "geographical/geology_moon_cog.tif",
      category: "geographical",
      displayName: "Global Geological Map",
      metadata: {
        source: "USGS",
        resolution: "1:5M",
        description: "Unified Geologic Map of the Moon"
      }
    },
    terrain_elevation: {
      filename: "geographical/lunar_terrain_elevation_COG.tif",
      category: "geographical",
      displayName: "Terrain Elevation",
      available: false,
      metadata: {
        source: "LOLA",
        resolution: "118m/pixel",
        description: "Lunar Orbiter Laser Altimeter elevation data"
      }
    },
    slope_map: {
      filename: "geographical/lunar_slope_map_COG.tif",
      category: "geographical",
      displayName: "Slope Map",
      available: false,
      metadata: {
        source: "LOLA",
        resolution: "118m/pixel",
        description: "Surface slope derived from LOLA data"
      }
    },
    iau_nomenclature: {
      filename: "stac/iau/nomenclature/iau_nomenclature_compact.json",
      layerType: "vector",
      category: "geographical",
      displayName: "IAU Feature Names",
      stac: "iau/nomenclature/iau_nomenclature_moon.json",
      metadata: {
        source: "IAU / USGS Planetary Nomenclature",
        description: "Named features on the Moon per IAU approved nomenclature"
      }
    },
    /*
      -----------------
      Chemical elements
      -----------------
    */
    hydrogen_lawrence2022: {
      filename: "chemical_elements/hydrogen/hydrogen_abundance_lawrence_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "hydrogen",
      displayName: "Hydrogen Abundance ppm (Lawrence 2022)",
      stac: "lunar_prospector/lawrence2022/hydrogen_abundance/hydrogen_abundance_lawrence.json"
    },
    thorium_grs: {
      filename: "chemical_elements/thorium/thoriumhd_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "thorium",
      displayName: "Thorium Abundance · LP GRS",
      stac: "lunar_prospector/grs/0.5deg/thorium/thoriumhd.json",
      variants: [
        {
          label: "0.5° low-alt",
          filename: "chemical_elements/thorium/thoriumhd_COG.tif",
          stac: "lunar_prospector/grs/0.5deg/thorium/thoriumhd.json"
        },
        {
          label: "2° high-alt",
          filename: "chemical_elements/thorium/thoriumhigh2d_COG.tif",
          stac: "lunar_prospector/grs/2deg/thoriumhigh/thoriumhigh2d.json"
        },
        {
          label: "2° low-alt",
          filename: "chemical_elements/thorium/thoriumlow2d_COG.tif",
          stac: "lunar_prospector/grs/2deg/thoriumlow/thoriumlow2d.json"
        },
        {
          label: "5°",
          filename: "chemical_elements/thorium/thorium5d_COG.tif",
          stac: "lunar_prospector/grs/5deg/thorium/thorium5d.json"
        }
      ]
    },
    thorium_count_rate_wilson: {
      filename: "chemical_elements/thorium/thorium_grs_wilson_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "thorium",
      units: "count_rate",
      displayName: "Thorium Count Rate · Wilson 2018",
      stac: "lunar_prospector/wilson2018/thorium_grs/thorium_grs_wilson.json"
    },
    uranium_lp_grs: {
      filename: "chemical_elements/uranium/uranium5d_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "uranium",
      units: "ppm",
      displayName: "Uranium Abundance · LP GRS",
      stac: "lunar_prospector/grs/5deg/uranium/uranium5d.json"
    },
    titanium_lp_grs: {
      filename: "chemical_elements/titanium/titanium2d_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "titanium",
      units: "wt%",
      displayName: "Titanium Abundance · LP GRS",
      stac: "lunar_prospector/grs/2deg/titanium/titanium2d.json",
      variants: [
        {
          label: "2°",
          filename: "chemical_elements/titanium/titanium2d_COG.tif",
          stac: "lunar_prospector/grs/2deg/titanium/titanium2d.json"
        },
        {
          label: "5°",
          filename: "chemical_elements/titanium/titanium5d_COG.tif",
          stac: "lunar_prospector/grs/5deg/titanium/titanium5d.json"
        }
      ]
    },
    silicon_lp_grs: {
      filename: "chemical_elements/silicon/silicon5d_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "silicon",
      units: "wt%",
      displayName: "Silicon Abundance · LP GRS",
      stac: "lunar_prospector/grs/5deg/silicon/silicon5d.json"
    },
    samarium_lp_grs: {
      filename: "chemical_elements/samarium/samarium2d_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "samarium",
      units: "ppm",
      displayName: "Samarium Abundance · LP GRS",
      stac: "lunar_prospector/grs/2deg/samarium/samarium2d.json"
    },
    gadolinium_lp_grs: {
      filename: "chemical_elements/gadolinium/gadolinium2d_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "gadolinium",
      units: "ppm",
      displayName: "Gadolinium Abundance · LP GRS",
      stac: "lunar_prospector/grs/2deg/gadolinium/gadolinium2d.json"
    },
    radon222_lp_aps: {
      filename: "chemical_elements/radon/radon222_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "radon",
      units: "count_rate",
      displayName: "Radon-222 Count Rate · LP APS",
      stac: "lunar_prospector/aps/radon222/radon222.json"
    },
    potassium_lp_grs: {
      filename: "chemical_elements/potassium/potassium2d_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "potassium",
      units: "ppm",
      displayName: "Potassium Abundance · LP GRS",
      stac: "lunar_prospector/grs/2deg/potassium/potassium2d.json",
      variants: [
        {
          label: "2°",
          filename: "chemical_elements/potassium/potassium2d_COG.tif",
          stac: "lunar_prospector/grs/2deg/potassium/potassium2d.json"
        },
        {
          label: "5°",
          filename: "chemical_elements/potassium/potassium5d_COG.tif",
          stac: "lunar_prospector/grs/5deg/potassium/potassium5d.json"
        }
      ]
    },
    polonium210_lp_aps: {
      filename: "chemical_elements/polonium/polonium210_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "polonium",
      units: "count_rate",
      displayName: "Polonium-210 Count Rate · LP APS",
      stac: "lunar_prospector/aps/polonium210/polonium210.json"
    },
    oxygen_lp_grs: {
      filename: "chemical_elements/oxygen/oxygen5d_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "oxygen",
      units: "wt%",
      displayName: "Oxygen Abundance · LP GRS",
      stac: "lunar_prospector/grs/5deg/oxygen/oxygen5d.json"
    },
    magnesium_lp_grs: {
      filename: "chemical_elements/magnesium/magnesium5d_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "magnesium",
      units: "wt%",
      displayName: "Magnesium Abundance · LP GRS",
      stac: "lunar_prospector/grs/5deg/magnesium/magnesium5d.json"
    },
    iron_lp_grs: {
      filename: "chemical_elements/iron/iron5d_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "iron",
      units: "wt%",
      displayName: "Iron Abundance · LP GRS",
      stac: "lunar_prospector/grs/5deg/iron/iron5d.json"
    },
    calcium_lp_grs: {
      filename: "chemical_elements/calcium/calcium5d_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "calcium",
      units: "wt%",
      displayName: "Calcium Abundance · LP GRS",
      stac: "lunar_prospector/grs/5deg/calcium/calcium5d.json"
    },
    aluminum_lp_grs: {
      filename: "chemical_elements/aluminum/aluminum5d_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "aluminum",
      units: "wt%",
      displayName: "Aluminium Abundance · LP GRS",
      stac: "lunar_prospector/grs/5deg/aluminum/aluminum5d.json"
    },
    /*
      --------
      Compound
      --------
    */
    feo_lp_grs: {
      filename: "compounds/feo/ironhd_COG.tif",
      layerType: "raster",
      category: "compound",
      compound: "feo",
      units: "wt% FeO",
      displayName: "FeO Abundance · LP GRS",
      stac: "lunar_prospector/grs/0.5deg/iron/ironhd.json"
    },
    feo_clementine_cnn_qiu2025: {
      filename: "compounds/feo/feo_clementine_cnn_qiu2025_COG.tif",
      layerType: "raster",
      category: "compound",
      compound: "feo",
      units: "wt%",
      displayName: "FeO Abundance · Clementine CNN (Qiu 2025)",
      stac: "clementine/qiu2025/feo/feo_clementine_cnn_qiu2025.json"
    },
    tio2_clementine_cnn_qiu2025: {
      filename: "compounds/tio2/tio2_clementine_cnn_qiu2025_COG.tif",
      layerType: "raster",
      category: "compound",
      compound: "tio2",
      units: "wt%",
      displayName: "TiO₂ Abundance · Clementine CNN (Qiu 2025)",
      stac: "clementine/qiu2025/tio2/tio2_clementine_cnn_qiu2025.json"
    },
    al2o3_clementine_cnn_qiu2025: {
      filename: "compounds/al2o3/al2o3_clementine_cnn_qiu2025_COG.tif",
      layerType: "raster",
      category: "compound",
      compound: "al2o3",
      units: "wt%",
      displayName: "Al₂O₃ Abundance · Clementine CNN (Qiu 2025)",
      stac: "clementine/qiu2025/al2o3/al2o3_clementine_cnn_qiu2025.json"
    },
    mgo_clementine_cnn_qiu2025: {
      filename: "compounds/mgo/mgo_clementine_cnn_qiu2025_COG.tif",
      layerType: "raster",
      category: "compound",
      compound: "mgo",
      units: "wt%",
      displayName: "MgO Abundance · Clementine CNN (Qiu 2025)",
      stac: "clementine/qiu2025/mgo/mgo_clementine_cnn_qiu2025.json"
    },
    cao_clementine_cnn_qiu2025: {
      filename: "compounds/cao/cao_clementine_cnn_qiu2025_COG.tif",
      layerType: "raster",
      category: "compound",
      compound: "cao",
      units: "wt%",
      displayName: "CaO Abundance · Clementine CNN (Qiu 2025)",
      stac: "clementine/qiu2025/cao/cao_clementine_cnn_qiu2025.json"
    },
    /*
      -------------
      Derived index
      -------------
    */
    mg_number: {
      filename: "derived/mg_number/mg_number_clementine_cnn_qiu2025_COG.tif",
      layerType: "raster",
      category: "derived-index",
      displayName: "Mg# Magnesium Number · Clementine CNN (Qiu 2025)",
      isDerivedIndex: true,
      units: "Mg# (0 to 1)",
      stac: "clementine/qiu2025/mg_number/mg_number_clementine_cnn_qiu2025.json",
      metadata: {
        source: "Clementine UVVIS + 1D CNN (Qiu et al. 2025)",
        resolution: "100m/pixel",
        description: "Magnesium Number derived from CNN-predicted MgO and FeO maps"
      }
    }
  }
} satisfies LayersConfig;
