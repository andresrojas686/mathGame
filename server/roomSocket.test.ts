import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { RoomManager } from './rooms.js';
import { attachRoomSocket } from './roomSocket.js';
import type { ClientMessage, ServerMessage } from './roomTypes.js';

/** Cliente de prueba: guarda todo lo recibido y permite esperar un tipo concreto. */
class TestClient {
  private readonly received: ServerMessage[] = [];
  private readonly waiters: { type: ServerMessage['type']; resolve: (m: never) => void }[] = [];

  private constructor(private readonly ws: WebSocket) {
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as ServerMessage;
      const index = this.waiters.findIndex((w) => w.type === msg.type);
      if (index >= 0) {
        const [waiter] = this.waiters.splice(index, 1);
        waiter?.resolve(msg as never);
      } else this.received.push(msg);
    });
  }

  static async connect(port: number): Promise<TestClient> {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });
    return new TestClient(ws);
  }

  send(message: ClientMessage): void {
    this.ws.send(JSON.stringify(message));
  }

  /** Espera el siguiente mensaje de ese tipo, ya esté en la cola o aún por llegar. */
  next<T extends ServerMessage['type']>(type: T, timeoutMs = 2000): Promise<Extract<ServerMessage, { type: T }>> {
    const index = this.received.findIndex((m) => m.type === type);
    if (index >= 0) return Promise.resolve(this.received.splice(index, 1)[0] as Extract<ServerMessage, { type: T }>);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no llegó ningún mensaje "${type}"`)), timeoutMs);
      this.waiters.push({
        type,
        resolve: ((m: ServerMessage) => {
          clearTimeout(timer);
          resolve(m as Extract<ServerMessage, { type: T }>);
        }) as never,
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.ws.once('close', () => resolve());
      this.ws.close();
    });
  }
}

describe('WebSocket de salas', () => {
  let server: Server;
  let detach: () => void;
  let rooms: RoomManager;
  let port: number;
  const clients: TestClient[] = [];

  beforeEach(async () => {
    rooms = new RoomManager();
    server = createServer((_req, res) => res.end('ok'));
    detach = attachRoomSocket(server, rooms);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((c) => c.close()));
    detach();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function connect(): Promise<TestClient> {
    const client = await TestClient.connect(port);
    clients.push(client);
    return client;
  }

  it('una partida completa entre dos jugadores', async () => {
    const ana = await connect();
    ana.send({ type: 'create', name: 'Ana', trainer: 'misty', level: 'normal', operation: 'multiplicar' });
    const welcome = await ana.next('welcome');
    const code = welcome.room.code;
    expect(welcome.room.players).toHaveLength(1);

    const beto = await connect();
    beto.send({ type: 'join', code, name: 'Beto', trainer: 'brock' });
    const betoWelcome = await beto.next('welcome');
    expect(betoWelcome.room.players).toHaveLength(2);

    // Ana se entera de que Beto entró (antes recibe el estado de su propia entrada).
    const update = await waitFor(ana, (room) => room.players.length === 2);
    expect(update.players.map((p) => p.name).sort()).toEqual(['Ana', 'Beto']);

    ana.send({ type: 'start' });
    const [startedAna, startedBeto] = await Promise.all([ana.next('started'), beto.next('started')]);
    expect(startedAna.room.state).toBe('playing');
    // La semilla es la misma para los dos: mismas operaciones, misma dificultad real.
    expect(startedAna.room.seed).toBe(startedBeto.room.seed);
    expect(startedAna.countdownMs).toBeGreaterThan(0);

    beto.send({ type: 'progress', correct: 4, waves: 1 });
    await waitFor(ana, (room) => room.players.some((p) => p.name === 'Beto' && p.correct === 4));

    ana.send({ type: 'finish', correct: 11, waves: 2 });
    beto.send({ type: 'finish', correct: 7, waves: 1 });

    const final = await waitFor(ana, (room) => room.state === 'ended');
    expect(final.players.map((p) => [p.name, p.correct])).toEqual([
      ['Ana', 11],
      ['Beto', 7],
    ]);
  });

  it('avisa con un error si la sala no existe', async () => {
    const client = await connect();
    client.send({ type: 'join', code: 'ZZZZZ', name: 'Ana', trainer: 'misty' });
    const error = await client.next('error');
    expect(error.code).toBe('sala-no-existe');
  });

  it('un invitado no puede empezar la partida', async () => {
    const ana = await connect();
    ana.send({ type: 'create', name: 'Ana', trainer: 'misty', level: 'facil', operation: 'multiplicar' });
    const code = (await ana.next('welcome')).room.code;

    const beto = await connect();
    beto.send({ type: 'join', code, name: 'Beto', trainer: 'brock' });
    await beto.next('welcome');

    beto.send({ type: 'start' });
    expect((await beto.next('error')).code).toBe('no-eres-anfitrion');
  });

  it('si alguien cierra la pestaña, su sitio se libera y el resto se entera', async () => {
    const ana = await connect();
    ana.send({ type: 'create', name: 'Ana', trainer: 'misty', level: 'facil', operation: 'multiplicar' });
    const code = (await ana.next('welcome')).room.code;

    const beto = await connect();
    beto.send({ type: 'join', code, name: 'Beto', trainer: 'brock' });
    await beto.next('welcome');
    await waitFor(ana, (room) => room.players.length === 2);

    await beto.close();
    clients.splice(clients.indexOf(beto), 1);

    const after = await waitFor(ana, (room) => room.players.length === 1);
    expect(after.players[0]?.name).toBe('Ana');
    expect(rooms.get(code)?.players.size).toBe(1);
  });

  it('acepta una sala llena de 50 jugadores y rechaza al siguiente', async () => {
    const ana = await connect();
    ana.send({ type: 'create', name: 'Ana', trainer: 'misty', level: 'facil', operation: 'multiplicar' });
    const code = (await ana.next('welcome')).room.code;

    for (let i = 1; i < 50; i++) {
      const guest = await connect();
      guest.send({ type: 'join', code, name: `J${i}`, trainer: 'brock' });
      await guest.next('welcome');
    }
    expect(rooms.get(code)?.players.size).toBe(50);

    const tarde = await connect();
    tarde.send({ type: 'join', code, name: 'Tarde', trainer: 'brock' });
    expect((await tarde.next('error')).code).toBe('sala-llena');
  }, 20000);
});

/** Espera estados de sala hasta que uno cumpla la condición. */
async function waitFor(client: TestClient, predicate: (room: Extract<ServerMessage, { type: 'room' }>['room']) => boolean) {
  for (let i = 0; i < 10; i++) {
    const msg = await client.next('room');
    if (predicate(msg.room)) return msg.room;
  }
  throw new Error('la sala nunca llegó al estado esperado');
}
