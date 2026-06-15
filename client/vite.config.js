import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
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
});
