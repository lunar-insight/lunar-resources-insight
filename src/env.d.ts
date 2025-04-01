declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'test' | 'production';
    REACT_APP_SERVER_URL: string;
    REACT_APP_WORKSPACE_PATH: string;
  }
}