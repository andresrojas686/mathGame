import { serve } from '@hono/node-server';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createApp } from './app.js';
import { RoomManager } from './rooms.js';
import { attachRoomSocket } from './roomSocket.js';
import { ScoreStore } from './scoreStore.js';

const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = process.env.DATA_DIR ?? path.resolve('data');
const DIST_DIR = process.env.DIST_DIR ?? path.resolve('dist');

const store = new ScoreStore(path.join(DATA_DIR, 'scores.json'));
const rooms = new RoomManager();
const dist = existsSync(DIST_DIR) ? DIST_DIR : null;
if (!dist) console.warn(`No existe ${DIST_DIR}: solo se sirve la API (modo desarrollo con Vite).`);

const server = serve({ fetch: createApp(store, dist, rooms).fetch, port: PORT }, (info) => {
  console.log(`Multiplicón API en http://localhost:${info.port}  (datos en ${DATA_DIR})`);
  console.log(`Salas multijugador en ws://localhost:${info.port}/ws`);
});

attachRoomSocket(server, rooms);

// Las salas viven en memoria; esta limpieza evita que una partida abandonada se quede para siempre.
const cleanup = setInterval(() => rooms.prune(), 5 * 60 * 1000);
cleanup.unref();
