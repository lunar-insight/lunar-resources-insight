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
      stac: "lro/lroc_wac/global_100m_june2013/lro_lroc_wac_global_100m_june2013.json"
    },
    /*
      ------------------
      Geographical layer
      ------------------
    */
    geological_global: {
      filename: "geographical/geology_moon_cog.tif",
      category: "geographical",
      displayName: "Global Geological Map"
    },
    terrain_elevation: {
      filename: "geographical/lunar_terrain_elevation_COG.tif",
      category: "geographical",
      displayName: "Terrain Elevation",
      available: false
    },
    slope_map: {
      filename: "geographical/lunar_slope_map_COG.tif",
      category: "geographical",
      displayName: "Slope Map",
      available: false
    },
    iau_nomenclature: {
      filename: "stac/iau/nomenclature/iau_nomenclature_compact.json",
      layerType: "vector",
      category: "geographical",
      displayName: "IAU Feature Names",
      stac: "iau/nomenclature/iau_nomenclature_moon.json"
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
    thorium_lp_grs_prettyman2006: {
      filename: "chemical_elements/thorium/thorium_2d_prettyman2006_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "thorium",
      units: "ppm",
      displayName: "Thorium Abundance · LP GRS (Prettyman 2006)",
      stac: "lunar_prospector/prettyman2006/2deg/thorium/thorium_2d_prettyman2006.json",
      variants: [
        {
          label: "2°",
          filename: "chemical_elements/thorium/thorium_2d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/2deg/thorium/thorium_2d_prettyman2006.json"
        },
        {
          label: "5°",
          filename: "chemical_elements/thorium/thorium_5d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/5deg/thorium/thorium_5d_prettyman2006.json"
        },
        {
          label: "20°",
          filename: "chemical_elements/thorium/thorium_20d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/20deg/thorium/thorium_20d_prettyman2006.json"
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
    thorium_kaguya_grs: {
      filename: "chemical_elements/thorium/thorium_nmap_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "thorium",
      units: "ppm",
      displayName: "Thorium Abundance · Kaguya GRS",
      stac: "kaguya/grs/nuclide_map/thorium/thorium_nmap.json"
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
    uranium_lp_grs_prettyman2006: {
      filename: "chemical_elements/uranium/uranium_2d_prettyman2006_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "uranium",
      units: "ppm",
      displayName: "Uranium Abundance · LP GRS (Prettyman 2006)",
      stac: "lunar_prospector/prettyman2006/2deg/uranium/uranium_2d_prettyman2006.json",
      variants: [
        {
          label: "2°",
          filename: "chemical_elements/uranium/uranium_2d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/2deg/uranium/uranium_2d_prettyman2006.json"
        },
        {
          label: "5°",
          filename: "chemical_elements/uranium/uranium_5d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/5deg/uranium/uranium_5d_prettyman2006.json"
        },
        {
          label: "20°",
          filename: "chemical_elements/uranium/uranium_20d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/20deg/uranium/uranium_20d_prettyman2006.json"
        }
      ]
    },
    uranium_kaguya_grs: {
      filename: "chemical_elements/uranium/uranium_nmap_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "uranium",
      units: "ppm",
      displayName: "Uranium Abundance · Kaguya GRS",
      stac: "kaguya/grs/nuclide_map/uranium/uranium_nmap.json"
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
    silicon_ch2_class: {
      filename: "chemical_elements/silicon/silicon_ch2_class_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "silicon",
      units: "wt%",
      displayName: "Silicon Abundance · Chandrayaan-2 CLASS",
      stac: "chandrayaan2/class/l2_map/silicon/silicon_ch2_class.json"
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
    potassium_lp_grs_prettyman2006: {
      filename: "chemical_elements/potassium/potassium_2d_prettyman2006_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "potassium",
      units: "ppm",
      displayName: "Potassium Abundance · LP GRS (Prettyman 2006)",
      stac: "lunar_prospector/prettyman2006/2deg/potassium/potassium_2d_prettyman2006.json",
      variants: [
        {
          label: "2°",
          filename: "chemical_elements/potassium/potassium_2d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/2deg/potassium/potassium_2d_prettyman2006.json"
        },
        {
          label: "5°",
          filename: "chemical_elements/potassium/potassium_5d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/5deg/potassium/potassium_5d_prettyman2006.json"
        },
        {
          label: "20°",
          filename: "chemical_elements/potassium/potassium_20d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/20deg/potassium/potassium_20d_prettyman2006.json"
        }
      ]
    },
    potassium_kaguya_grs: {
      filename: "chemical_elements/potassium/potassium_nmap_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "potassium",
      units: "ppm",
      displayName: "Potassium Abundance · Kaguya GRS",
      stac: "kaguya/grs/nuclide_map/potassium/potassium_nmap.json"
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
    magnesium_ch2_class: {
      filename: "chemical_elements/magnesium/magnesium_ch2_class_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "magnesium",
      units: "wt%",
      displayName: "Magnesium Abundance · Chandrayaan-2 CLASS",
      stac: "chandrayaan2/class/l2_map/magnesium/magnesium_ch2_class.json"
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
    iron_ch2_class: {
      filename: "chemical_elements/iron/iron_ch2_class_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "iron",
      units: "wt%",
      displayName: "Iron Abundance · Chandrayaan-2 CLASS",
      stac: "chandrayaan2/class/l2_map/iron/iron_ch2_class.json"
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
    aluminum_ch2_class: {
      filename: "chemical_elements/aluminum/aluminum_ch2_class_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "aluminum",
      units: "wt%",
      displayName: "Aluminium Abundance · Chandrayaan-2 CLASS",
      stac: "chandrayaan2/class/l2_map/aluminum/aluminum_ch2_class.json"
    },
    sodium_ch2_class: {
      filename: "chemical_elements/sodium/sodium_ch2_class_COG.tif",
      layerType: "raster",
      category: "chemical",
      element: "sodium",
      units: "wt%",
      displayName: "Sodium Abundance · Chandrayaan-2 CLASS",
      stac: "chandrayaan2/class/l2_map/sodium/sodium_ch2_class.json"
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
    feo_lp_grs_prettyman2006: {
      filename: "compounds/feo/feo_2d_prettyman2006_COG.tif",
      layerType: "raster",
      category: "compound",
      compound: "feo",
      units: "wt%",
      displayName: "FeO Abundance · LP GRS (Prettyman 2006)",
      stac: "lunar_prospector/prettyman2006/2deg/feo/feo_2d_prettyman2006.json",
      variants: [
        {
          label: "2°",
          filename: "compounds/feo/feo_2d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/2deg/feo/feo_2d_prettyman2006.json"
        },
        {
          label: "5°",
          filename: "compounds/feo/feo_5d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/5deg/feo/feo_5d_prettyman2006.json"
        },
        {
          label: "20°",
          filename: "compounds/feo/feo_20d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/20deg/feo/feo_20d_prettyman2006.json"
        }
      ]
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
    tio2_lp_grs_prettyman2006: {
      filename: "compounds/tio2/tio2_2d_prettyman2006_COG.tif",
      layerType: "raster",
      category: "compound",
      compound: "tio2",
      units: "wt%",
      displayName: "TiO₂ Abundance · LP GRS (Prettyman 2006)",
      stac: "lunar_prospector/prettyman2006/2deg/tio2/tio2_2d_prettyman2006.json",
      variants: [
        {
          label: "2°",
          filename: "compounds/tio2/tio2_2d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/2deg/tio2/tio2_2d_prettyman2006.json"
        },
        {
          label: "5°",
          filename: "compounds/tio2/tio2_5d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/5deg/tio2/tio2_5d_prettyman2006.json"
        },
        {
          label: "20°",
          filename: "compounds/tio2/tio2_20d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/20deg/tio2/tio2_20d_prettyman2006.json"
        }
      ]
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
    al2o3_lp_grs_prettyman2006: {
      filename: "compounds/al2o3/al2o3_2d_prettyman2006_COG.tif",
      layerType: "raster",
      category: "compound",
      compound: "al2o3",
      units: "wt%",
      displayName: "Al₂O₃ Abundance · LP GRS (Prettyman 2006)",
      stac: "lunar_prospector/prettyman2006/2deg/al2o3/al2o3_2d_prettyman2006.json",
      variants: [
        {
          label: "2°",
          filename: "compounds/al2o3/al2o3_2d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/2deg/al2o3/al2o3_2d_prettyman2006.json"
        },
        {
          label: "5°",
          filename: "compounds/al2o3/al2o3_5d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/5deg/al2o3/al2o3_5d_prettyman2006.json"
        },
        {
          label: "20°",
          filename: "compounds/al2o3/al2o3_20d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/20deg/al2o3/al2o3_20d_prettyman2006.json"
        }
      ]
    },
    sio2_lp_grs_prettyman2006: {
      filename: "compounds/sio2/sio2_2d_prettyman2006_COG.tif",
      layerType: "raster",
      category: "compound",
      compound: "sio2",
      units: "wt%",
      displayName: "SiO₂ Abundance · LP GRS (Prettyman 2006)",
      stac: "lunar_prospector/prettyman2006/2deg/sio2/sio2_2d_prettyman2006.json",
      variants: [
        {
          label: "2°",
          filename: "compounds/sio2/sio2_2d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/2deg/sio2/sio2_2d_prettyman2006.json"
        },
        {
          label: "5°",
          filename: "compounds/sio2/sio2_5d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/5deg/sio2/sio2_5d_prettyman2006.json"
        },
        {
          label: "20°",
          filename: "compounds/sio2/sio2_20d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/20deg/sio2/sio2_20d_prettyman2006.json"
        }
      ]
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
    mgo_lp_grs_prettyman2006: {
      filename: "compounds/mgo/mgo_2d_prettyman2006_COG.tif",
      layerType: "raster",
      category: "compound",
      compound: "mgo",
      units: "wt%",
      displayName: "MgO Abundance · LP GRS (Prettyman 2006)",
      stac: "lunar_prospector/prettyman2006/2deg/mgo/mgo_2d_prettyman2006.json",
      variants: [
        {
          label: "2°",
          filename: "compounds/mgo/mgo_2d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/2deg/mgo/mgo_2d_prettyman2006.json"
        },
        {
          label: "5°",
          filename: "compounds/mgo/mgo_5d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/5deg/mgo/mgo_5d_prettyman2006.json"
        },
        {
          label: "20°",
          filename: "compounds/mgo/mgo_20d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/20deg/mgo/mgo_20d_prettyman2006.json"
        }
      ]
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
    cao_lp_grs_prettyman2006: {
      filename: "compounds/cao/cao_2d_prettyman2006_COG.tif",
      layerType: "raster",
      category: "compound",
      compound: "cao",
      units: "wt%",
      displayName: "CaO Abundance · LP GRS (Prettyman 2006)",
      stac: "lunar_prospector/prettyman2006/2deg/cao/cao_2d_prettyman2006.json",
      variants: [
        {
          label: "2°",
          filename: "compounds/cao/cao_2d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/2deg/cao/cao_2d_prettyman2006.json"
        },
        {
          label: "5°",
          filename: "compounds/cao/cao_5d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/5deg/cao/cao_5d_prettyman2006.json"
        },
        {
          label: "20°",
          filename: "compounds/cao/cao_20d_prettyman2006_COG.tif",
          stac: "lunar_prospector/prettyman2006/20deg/cao/cao_20d_prettyman2006.json"
        }
      ]
    },
    cao_kaguya_grs: {
      filename: "compounds/cao/calcium_nmap_COG.tif",
      layerType: "raster",
      category: "compound",
      compound: "cao",
      units: "wt%",
      displayName: "CaO Abundance · Kaguya GRS",
      stac: "kaguya/grs/nuclide_map/calcium/calcium_nmap.json"
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
      stac: "clementine/qiu2025/mg_number/mg_number_clementine_cnn_qiu2025.json"
    }
  }
} satisfies LayersConfig;
