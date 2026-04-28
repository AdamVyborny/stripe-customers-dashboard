import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    command === 'serve' && {
      name: 'keboola-health-check',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.method === 'POST' && req.url === '/') {
            res.statusCode = 200;
            res.end('ok');
            return;
          }
          next();
        });
      },
    },
  ],
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    hmr: { clientPort: 443, protocol: 'wss' },
    watch: { usePolling: true, interval: 200 },
  },
  build: { outDir: 'dist/client', emptyOutDir: true },
}));
