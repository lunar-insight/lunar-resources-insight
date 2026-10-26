import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'node:fs'

const cesiumSource = 'node_modules/cesium/Build/Cesium'
const cesiumBaseUrl = 'cesiumStatic'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: 'cesium-static-dev',
      apply: 'serve',
      configureServer(server) {
        const mimeTypes: Record<string, string> = {
          '.js': 'application/javascript',
          '.json': 'application/json',
          '.css': 'text/css',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2',
          '.glb': 'model/gltf-binary',
          '.gltf': 'model/gltf+json',
        }
        server.middlewares.use(`/${cesiumBaseUrl}`, (req, res, next) => {
          const filePath = path.resolve(__dirname, cesiumSource, (req.url ?? '/').replace(/^\//, ''))
          fs.stat(filePath, (err, stat) => {
            if (err || !stat.isFile()) return next()
            const ext = path.extname(filePath).toLowerCase()
            res.setHeader('Content-Type', mimeTypes[ext] ?? 'application/octet-stream')
            res.setHeader('Cache-Control', 'public, max-age=86400')
            res.setHeader('Content-Length', stat.size)
            fs.createReadStream(filePath).pipe(res)
          })
        })
      },
    },
    {
      name: 'cesium-build-copy',
      apply: 'build',
      closeBundle() {
        for (const dir of ['ThirdParty', 'Workers', 'Assets', 'Widgets']) {
          fs.cpSync(
            path.resolve(__dirname, cesiumSource, dir),
            path.resolve(__dirname, 'dist', cesiumBaseUrl, dir),
            { recursive: true }
          )
        }
      },
    },
  ],
  define: {
    CESIUM_BASE_URL: JSON.stringify(`/${cesiumBaseUrl}`),
  },
  resolve: {
    alias: {
      '@':                 path.resolve(__dirname, 'src'),
      'assets':            path.resolve(__dirname, 'src/assets'),
      'components':        path.resolve(__dirname, 'src/components'),
      'utils':             path.resolve(__dirname, 'src/utils'),
      'types':             path.resolve(__dirname, 'src/types'),
      'hooks':             path.resolve(__dirname, 'src/hooks'),
      'services':          path.resolve(__dirname, 'src/services'),
      'pages':             path.resolve(__dirname, 'src/pages'),
      'fonts':             path.resolve(__dirname, 'src/fonts'),
      'geoConfigExporter': path.resolve(__dirname, 'src/geoConfigExporter.ts'),
      'constants':         path.resolve(__dirname, 'src/constants'),
    },
  },
  optimizeDeps: {
    include: ['cesium', 'react', 'react-dom', 'react-dom/client', 'd3'],
  },
  build: {
    sourcemap: true,
  },
  css: {
    modules: {
      generateScopedName: mode === 'production'
        ? '[hash:base64:5]'
        : '[name]__[local]--[hash:base64:5]',
    },
  },
  server: {
    host: '127.0.0.1',
    open: true,
    watch: {
      usePolling: true,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // App tests only; scripts/tests runs with node --test.
    include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    setupFiles: ['./src/setupTests.ts'],
    // The Inspector window tests take about 2 s alone and over 5 s (the default)
    // in a full parallel run on a loaded machine; the prod build runs the suite.
    testTimeout: 20000,
    // Test values, independent of .env.
    env: {
      VITE_SERVER_URL: '',
      VITE_WORKSPACE_PATH: '/data',
      VITE_TERRAIN_URL: 'http://localhost:3001',
    },
  },
}))