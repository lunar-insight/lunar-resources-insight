interface ImportMetaEnv {
  readonly VITE_SERVER_URL: string;
  readonly VITE_WORKSPACE_PATH: string;
  readonly VITE_TERRAIN_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Path of Cesium's static assets, set by `define` in vite.config.ts.
declare const CESIUM_BASE_URL: string;
