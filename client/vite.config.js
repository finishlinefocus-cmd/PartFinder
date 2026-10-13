import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  // Built for Nexus, which serves client/dist at /pf/ and proxies /pf/api to the API (2026-10-13);
  // the dev server keeps '/' with its own /api proxy below. PF_BASE overrides either.
  base: process.env.PF_BASE || (command === 'build' ? '/pf/' : '/'),
  plugins: [react()],
  server: {
    // Fixed/uncommon port; strictPort = fail loudly instead of silently hopping to 4812.
    port: 4811,
    strictPort: true,
    host: true,
    // Reach the client through the Caddy hostname (https://partfinder.test) on any machine.
    allowedHosts: ['partfinder.test', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': 'http://localhost:4810'
    }
  }
}));
