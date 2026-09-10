import { serve } from '@hono/node-server';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createApp } from './app.js';
import { ScoreStore } from './scoreStore.js';

const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = process.env.DATA_DIR ?? path.resolve('data');
const DIST_DIR = process.env.DIST_DIR ?? path.resolve('dist');

const store = new ScoreStore(path.join(DATA_DIR, 'scores.json'));
const dist = existsSync(DIST_DIR) ? DIST_DIR : null;
if (!dist) console.warn(`No existe ${DIST_DIR}: solo se sirve la API (modo desarrollo con Vite).`);

serve({ fetch: createApp(store, dist).fetch, port: PORT }, (info) => {
  console.log(`Multiplicón API en http://localhost:${info.port}  (datos en ${DATA_DIR})`);
});
