interface ImportMetaEnv {
  readonly VITE_SERVER_URL: string;
  readonly VITE_WORKSPACE_PATH: string;
  readonly VITE_TERRAIN_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
