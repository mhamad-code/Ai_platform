import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app talks to an optional server gateway (see /server) for provider
// API calls, key storage and web search. In development you can point
// VITE_GATEWAY_URL at http://localhost:8787 and Vite will proxy it so the
// browser always stays on the same origin.
const gateway = process.env.VITE_GATEWAY_URL ?? 'http://localhost:8787';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    // Extra preview hosts come from the environment (never hard-coded), e.g.
    // VITE_ALLOWED_HOSTS=preview.example.com npm run dev
    allowedHosts: (process.env.VITE_ALLOWED_HOSTS ?? '')
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean),
    proxy: {
      '/gw': {
        target: gateway,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gw/, ''),
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
  },
});
