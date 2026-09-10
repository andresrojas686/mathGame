/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      // Servidor Hono del ranking: `pnpm dev:server` en otra terminal.
      '/api': 'http://localhost:8787',
    },
  },
  build: {
    // Phaser es un único bundle de ~1.2 MB (320 KB comprimido); no hay nada que partir.
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
