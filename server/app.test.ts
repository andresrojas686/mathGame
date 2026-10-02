import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { RoomManager } from './rooms';
import { ScoreStore } from './scoreStore';

describe('API', () => {
  let dir: string;
  let app: ReturnType<typeof createApp>;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'multiplicon-api-'));
    app = createApp(new ScoreStore(path.join(dir, 'scores.json')), null);
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  const post = (body: unknown) =>
    app.request('/api/scores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  it('GET /api/health', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('POST /api/scores guarda y GET /api/leaderboard lo devuelve', async () => {
    const res = await post({ name: 'Sofía', level: 'facil', operation: 'multiplicar', correct: 8, waves: 1 });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.position).toBe(1);
    expect(body.entry.name).toBe('Sofía');

    const lb = await (await app.request('/api/leaderboard')).json();
    expect(lb.version).toBe(2);
    expect(lb.boards['multiplicar:facil']).toHaveLength(1);
  });

  it('el leaderboard muestra como máximo 10 por tabla', async () => {
    for (let i = 0; i < 15; i++) await post({ name: 'x', level: 'facil', correct: i, waves: 0 });
    const lb = await (await app.request('/api/leaderboard')).json();
    expect(lb.boards['multiplicar:facil']).toHaveLength(10);
    expect(lb.boards['multiplicar:facil'][0].correct).toBe(14);
  });

  it('rechaza cuerpos inválidos con 400', async () => {
    expect((await post({ name: 'x', level: 'nope', correct: 1, waves: 0 })).status).toBe(400);
    const bad = await app.request('/api/scores', { method: 'POST', body: '{{', headers: { 'content-type': 'application/json' } });
    expect(bad.status).toBe(400);
  });

  it('rutas /api desconocidas devuelven 404 JSON', async () => {
    const res = await app.request('/api/nada');
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBeDefined();
  });
});

describe('API de salas', () => {
  it('GET /api/rooms/:code describe una sala viva e ignora mayúsculas', () => {
    const rooms = new RoomManager();
    const app = createApp(new ScoreStore('/tmp/no-se-escribe.json'), null, rooms);
    const { room } = rooms.create({ name: 'Ana', trainer: 'misty', level: 'facil', operation: 'multiplicar' });
    return app
      .request(`/api/rooms/${room.code.toLowerCase()}`)
      .then(async (res) => {
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ code: room.code, state: 'lobby', players: 1, max: 50 });
      });
  });

  it('GET /api/rooms/:code responde 404 si la sala no existe', async () => {
    const app = createApp(new ScoreStore('/tmp/no-se-escribe.json'), null, new RoomManager());
    const res = await app.request('/api/rooms/ZZZZZ');
    expect(res.status).toBe(404);
  });

  it('sin multijugador el endpoint responde 503', async () => {
    const app = createApp(new ScoreStore('/tmp/no-se-escribe.json'), null);
    const res = await app.request('/api/rooms/ZZZZZ');
    expect(res.status).toBe(503);
  });
});
