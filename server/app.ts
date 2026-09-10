import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import path from 'node:path';
import type { ScoreStore } from './scoreStore.js';
import { parseScoreInput, ValidationError } from './validation.js';

/** Cuántas entradas por tabla salen al cliente. El archivo conserva más (KEEP_PER_BOARD). */
export const SHOW_PER_BOARD = 10;

/**
 * API del ranking y, si se indica `distDir`, los estáticos del build de Vite.
 * Separado de index.ts para poder probarlo con `app.request()` sin abrir un puerto.
 */
export function createApp(store: ScoreStore, distDir: string | null): Hono {
  const app = new Hono();

  app.get('/api/health', (c) => c.json({ ok: true }));

  app.get('/api/leaderboard', async (c) => {
    const data = await store.leaderboard();
    const boards = Object.fromEntries(Object.entries(data.boards).map(([k, v]) => [k, v.slice(0, SHOW_PER_BOARD)]));
    return c.json({ version: data.version, boards });
  });

  app.post('/api/scores', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'JSON inválido' }, 400);
    }
    try {
      const input = parseScoreInput(body);
      const result = await store.submit(input);
      return c.json(result, 201);
    } catch (err) {
      if (err instanceof ValidationError) return c.json({ error: err.message }, 400);
      console.error('POST /api/scores', err);
      return c.json({ error: 'no se pudo guardar la puntuación' }, 500);
    }
  });

  app.all('/api/*', (c) => c.json({ error: 'no encontrado' }, 404));

  if (distDir) {
    const root = path.relative(process.cwd(), distDir) || '.';
    app.use('/*', serveStatic({ root }));
    // Cualquier otra ruta devuelve index.html (la app es de una sola página).
    app.get('*', serveStatic({ root, path: 'index.html' }));
  }

  return app;
}
