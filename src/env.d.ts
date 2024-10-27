declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'test' | 'production';
    REACT_APP_GEOSERVER_URL: string;
    REACT_APP_GEOSERVER_WORKSPACE_NAME: string;
  }
}