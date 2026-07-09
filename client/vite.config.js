import { defineConfig, loadEnv } from 'vite';
process.env = { ...process.env, ...loadEnv('', process.cwd(), '') };
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4810',
      // Nexus semantic part search — the shared key is injected HERE (server-side),
      // so it never appears in browser JS. Set PARTFINDER_KEY in client/.env.local
      // to match the Nexus .env value.
      '/nexus-semantic': {
        target: 'http://localhost:4800',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/nexus-semantic/, '/api/vendors/semantic/search'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('x-pf-key', process.env.PARTFINDER_KEY || '');
          });
        },
      },
    }
  }
});
