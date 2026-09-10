/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      // Servidor Hono del ranking (Fase 3). Inerte hasta que exista.
      '/api': 'http://localhost:8787',
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
});
