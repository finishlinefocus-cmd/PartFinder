import { defineConfig, loadEnv } from 'vite';
process.env = { ...process.env, ...loadEnv('', process.cwd(), '') };
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Served under /pf/ so the Nexus gateway (nexus:4800/pf/*) can front this app for remote
  // users — every asset and API path carries the prefix. Direct use moves to
  // http://localhost:4811/pf/ (the bare root now redirects nowhere — use the /pf/ URL).
  base: '/pf/',
  plugins: [react()],
  server: {
    proxy: {
      '/pf/api': {
        target: 'http://localhost:4810',
        rewrite: (p) => p.replace(/^\/pf/, ''),
      },
      // Nexus semantic part search — the shared key is injected HERE (server-side),
      // so it never appears in browser JS. Set PARTFINDER_KEY in client/.env.local
      // to match the Nexus .env value.
      '/pf/nexus-semantic': {
        target: 'http://localhost:4800',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/pf\/nexus-semantic/, '/api/vendors/semantic/search'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('x-pf-key', process.env.PARTFINDER_KEY || '');
          });
        },
      },
    }
  }
});
