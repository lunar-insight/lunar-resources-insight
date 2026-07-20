// Command: node terrain-server.js

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.TERRAIN_PORT || 3001;
const TERRAIN_PATH = process.env.TERRAIN_PATH || path.join('D:', 'Terrain', 'cesium-terrain');

// Request queue to prevent overload
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 50; // Limit concurrent requests
const requestQueue = [];

function processRequest(req, res, handler) {
  if (activeRequests < MAX_CONCURRENT_REQUESTS) {
    activeRequests++;
    handler(req, res);
  } else {
    // Queue the request
    requestQueue.push({ req, res, handler });
  }
}

function requestComplete() {
  activeRequests--;

  // Process next queued request
  if (requestQueue.length > 0) {
    const { req, res, handler } = requestQueue.shift();
    activeRequests++;
    handler(req, res);
  }
}

const fileCache = new Map();
const CACHE_MAX_SIZE = 500; // Nb of file paths cached
const CACHE_TTL = 300000; // 5 minutes

// LRU cache for frequently accessed tiles
const tileCache = new Map();
const MAX_TILE_CACHE_SIZE = 50; // Cache 50 hot tiles (~5-10 MB)
const TILE_CACHE_TTL = 600000; // 10 minutes

function checkFileExists(filePath) {
  const cached = fileCache.get(filePath);
  const now = Date.now();

  // Return cached result if still valid
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return Promise.resolve(cached.stats);
  }

  // Check file and cache result
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        reject(err);
        return;
      }

      // Add to cache (with LRU eviction)
      if (fileCache.size >= CACHE_MAX_SIZE) {
        const firstKey = fileCache.keys().next().value;
        fileCache.delete(firstKey);
      }

      fileCache.set(filePath, { stats, timestamp: now });
      resolve(stats);
    });
  });
}

// Tile cache helper functions
function getCachedTile(filePath) {
  const cached = tileCache.get(filePath);
  if (cached && (Date.now() - cached.timestamp) < TILE_CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function cacheTile(filePath, data) {
  // LRU eviction
  if (tileCache.size >= MAX_TILE_CACHE_SIZE) {
    const firstKey = tileCache.keys().next().value;
    tileCache.delete(firstKey);
  }

  tileCache.set(filePath, {
    data: data,
    timestamp: Date.now()
  });
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

  // Handle OPTIONS preflight requests (no queuing needed)
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint (no queuing needed)
  if (req.url === '/health' || req.url === '/ping') {
    res.writeHead(200, { 'content-type': 'application/json'});
    res.end(JSON.stringify({
      status: 'ok',
      uptime: process.uptime(),
      activeRequests: activeRequests,
      queueLength: requestQueue.length,
      cacheSize: fileCache.size,
      tileCacheSize: tileCache.size,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Silent favicon requests for log (no queuing needed)
  if (req.url == '/favicon.ico') {
    res.writeHead(204); // No Content
    res.end();
    return;
  }

  // Define the actual file request handler
  const handler = async (request, response) => {
    // Track request start time for performance monitoring
    const requestStart = Date.now();

    // Helper function to log performance
    const logPerformance = (url, fromCache = false) => {
      const requestDuration = Date.now() - requestStart;
      const cacheIndicator = fromCache ? ' [CACHED]' : '';
      if (requestDuration > 100) {
        console.warn(`⚠ Slow (${requestDuration}ms)${cacheIndicator}: ${url}`);
      } else {
        console.log(`✓ ${requestDuration}ms${cacheIndicator} - ${url}`);
      }
    };

    // Build file path + prevent path traversal
    const requestedPath = request.url.split('?')[0]; // Remove query parameters
    const normalizedPath = path.normalize(requestedPath).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(TERRAIN_PATH, normalizedPath);

    // Verify the resolved path is still within TERRAIN_PATH (path traversal related)
    const resolvedPath = path.resolve(filePath);
    const resolvedBase = path.resolve(TERRAIN_PATH);
    if (!resolvedPath.startsWith(resolvedBase)) {
      logPerformance(request.url);
      console.error(`403 Forbidden`);
      response.writeHead(403, { 'Content-Type': 'text/plain' });
      response.end('403 Forbidden');
      requestComplete();
      return;
    }

    try {
      const stats = await checkFileExists(filePath);

      // Determine content type based on file extension
      let contentType = 'application/octet-stream';
      let contentEncoding = null;

      if (filePath.endsWith('.json')) {
        contentType = 'application/json';
      } else if (filePath.endsWith('.terrain')) {
        contentType = 'application/octet-stream';
        contentEncoding = null;
      }

      // Set headers
      const headers = {
        'Content-Type': contentType,
      };

      if (contentEncoding) {
        headers['Content-Encoding'] = contentEncoding
      }

      // Add caching headers
      if (filePath.endsWith('.terrain')) {
        headers['Cache-Control'] = 'public, max-age=31536000'; // 1 year
      } else if (filePath.endsWith('.json')) {
        headers['Cache-Control'] = 'public, max-age=300'; // 5 minutes
      }

      // Check tile cache first
      const cachedData = getCachedTile(filePath);
      if (cachedData) {
        logPerformance(request.url, true);
        response.writeHead(200, headers);
        response.end(cachedData);
        requestComplete();
        return;
      }

      // Not in cache - stream from disk and cache for next time
      const readStream = fs.createReadStream(filePath);
      const chunks = [];

      readStream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      readStream.on('end', () => {
        const data = Buffer.concat(chunks);

        // Cache for next time (only cache small files < 100KB)
        if (data.length < 100000) {
          cacheTile(filePath, data);
        }

        logPerformance(request.url);
        response.end(data);
        requestComplete();
      });

      readStream.on('error', (err) => {
        logPerformance(request.url);
        console.error(`Error reading file: ${err.message}`);
        response.writeHead(500, { 'Content-Type': 'text/plain' });
        response.end('500 Internal Server Error');
        requestComplete();
      });

      response.writeHead(200, headers);
    } catch (err) {
      logPerformance(request.url);
      console.error(`404 Not Found: ${request.url}`);
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('404 Not Found');
      requestComplete();
    }
  };

  // Process request through queue system
  processRequest(req, res, handler);
});

// Start server
const HOST = process.env.TERRAIN_HOST || '127.0.0.1';
server.listen(PORT, HOST, () => {
  console.log(
    `
─────────────────────────────────────────────────────
  Terrain Tile Server                            
─────────────────────────────────────────────────────
  Status:   Running                              
  Port:     ${PORT}
  URL:      http://localhost:${PORT}
  Path:     ${TERRAIN_PATH}
─────────────────────────────────────────────────────
  Test:     http://localhost:${PORT}/layer.json
  Health:   http://localhost:${PORT}/health
─────────────────────────────────────────────────────
  `);
});

// Enable HTTP Keep-Alive for persistent connections
server.keepAliveTimeout = 65000; // 65 seconds
server.headersTimeout = 66000;

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n Error: Port ${PORT} is already in use!`);
    console.error(` Stop the other process or change PORT in terrain-server.js\n`)
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down terrain server...');
  server.close(() => {
    console.log('Server stopped.');
    process.exit(0);
  });
});