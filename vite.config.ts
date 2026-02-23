import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // Ensure root-relative asset URLs to avoid cross-origin redirects in production
  base: '/',
  plugins: [react()],
  optimizeDeps: {
    include: [
      'chart.js',
      'react-chartjs-2',
      'framer-motion',
    ],
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        // Ensure proper hashing for cache busting
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['react-router-dom'],
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          'ui-vendor': ['lucide-react', 'framer-motion'],
        }
      }
    },
    // Suppress warnings about server-only packages
    chunkSizeWarningLimit: 1000,
  },
  // Prevent Vite from trying to bundle server-only packages
  ssr: {
    noExternal: []
  },
  // Exclude server-only packages from client bundle
  resolve: {
    alias: {
      // These packages should only be used in Netlify functions
      'firebase-admin': 'empty-module',
      'openai': 'empty-module',
      'node-mailjet': 'empty-module'
    }
  },
  // Proxy for API routes during development
  // This allows the Vite dev server to forward /api/* requests to Vercel dev on port 3000
  // Frontend runs on http://localhost:5173 (React Refresh works)
  // API runs on http://localhost:3000/api/* (via vercel dev)
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        timeout: 30000,
        // Handle proxy errors - return proper error response instead of generic message
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            console.warn('[Vite Proxy] Connection error:', err.message);
            console.warn('[Vite Proxy] Ensure dev-server.js is running: node dev-server.js (or npm run dev:api)');
            if (!res.headersSent) {
              res.writeHead(503, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              });
              // Return a specific error that can be handled by the client
              res.end(JSON.stringify({ 
                ok: false,
                error: `Cannot connect to API server at http://localhost:3001. Make sure the development API server is running (node dev-server.js).`,
                code: 'PROXY_CONNECTION_ERROR'
              }));
            }
          });
        }
      },
    },
  },
});
