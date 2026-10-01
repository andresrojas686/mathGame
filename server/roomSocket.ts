import type { ServerType } from '@hono/node-server';
import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { parseClientMessage } from './roomMessages.js';
import { roomView, type Room, type RoomManager } from './rooms.js';
import { COUNTDOWN_MS, RoomError, type ClientMessage, type ServerMessage } from './roomTypes.js';

/** Cada cuánto se comprueba que la conexión sigue viva. */
const HEARTBEAT_MS = 30_000;
/** Los avances se agrupan: con 50 jugadores contestando no hace falta un envío por acierto. */
const BROADCAST_MS = 250;
/** Mensajes aceptados por ventana de 5 s antes de cortar la conexión. */
const RATE_LIMIT = 150;
const RATE_WINDOW_MS = 5_000;

interface Conn {
  ws: WebSocket;
  code: string | null;
  playerId: string | null;
  alive: boolean;
  count: number;
  windowStart: number;
}

/**
 * `serve()` de @hono/node-server declara que podría devolver un servidor HTTP/2.
 * Con la configuración de este proyecto siempre es HTTP/1.1, que es lo que habla `ws`.
 */
export type AttachableServer = ServerType;

export interface RoomSocketOptions {
  path?: string;
  now?: () => number;
}

/**
 * Expone el RoomManager por WebSocket en `/ws`.
 * Un socket es un jugador: si se cae, el jugador sale de la sala.
 */
export function attachRoomSocket(server: AttachableServer, rooms: RoomManager, opts: RoomSocketOptions = {}): () => void {
  const path = opts.path ?? '/ws';
  const now = opts.now ?? (() => Date.now());
  const wss = new WebSocketServer({ server: server as HttpServer, path });
  const byRoom = new Map<string, Set<Conn>>();
  const conns = new Set<Conn>();
  const pending = new Map<string, NodeJS.Timeout>();

  function send(conn: Conn, message: ServerMessage): void {
    if (conn.ws.readyState === conn.ws.OPEN) conn.ws.send(JSON.stringify(message));
  }

  function broadcast(code: string, message: ServerMessage): void {
    const payload = JSON.stringify(message);
    for (const conn of byRoom.get(code) ?? []) {
      if (conn.ws.readyState === conn.ws.OPEN) conn.ws.send(payload);
    }
  }

  /** Envía el estado de la sala como mucho cada BROADCAST_MS. */
  function scheduleState(code: string): void {
    if (pending.has(code)) return;
    pending.set(
      code,
      setTimeout(() => {
        pending.delete(code);
        const room = rooms.get(code);
        if (room) broadcast(code, { type: 'room', room: roomView(room) });
      }, BROADCAST_MS),
    );
  }

  function flushState(code: string): void {
    const timer = pending.get(code);
    if (timer) {
      clearTimeout(timer);
      pending.delete(code);
    }
    const room = rooms.get(code);
    if (room) broadcast(code, { type: 'room', room: roomView(room) });
  }

  function attach(conn: Conn, room: Room, playerId: string): void {
    conn.code = room.code;
    conn.playerId = playerId;
    let set = byRoom.get(room.code);
    if (!set) {
      set = new Set();
      byRoom.set(room.code, set);
    }
    set.add(conn);
    send(conn, { type: 'welcome', playerId, room: roomView(room) });
    flushState(room.code);
  }

  function detach(conn: Conn): void {
    const { code, playerId } = conn;
    if (!code || !playerId) return;
    conn.code = null;
    conn.playerId = null;
    const set = byRoom.get(code);
    set?.delete(conn);
    if (set && set.size === 0) byRoom.delete(code);
    rooms.leave(code, playerId);
    if (rooms.get(code)) flushState(code);
  }

  function handle(conn: Conn, message: ClientMessage): void {
    if (message.type === 'ping') {
      send(conn, { type: 'pong' });
      return;
    }

    if (message.type === 'create' || message.type === 'join') {
      if (conn.code) detach(conn);
      const handle = message.type === 'create' ? rooms.create(message) : rooms.join(message.code, message);
      attach(conn, handle.room, handle.playerId);
      return;
    }

    const { code, playerId } = conn;
    if (!code || !playerId) throw new RoomError('sin-sala', 'todavía no estás en una sala');

    switch (message.type) {
      case 'start': {
        const room = rooms.start(code, playerId);
        broadcast(code, { type: 'started', room: roomView(room), countdownMs: COUNTDOWN_MS });
        flushState(code);
        break;
      }
      case 'progress':
        rooms.progress(code, playerId, message.correct, message.waves);
        scheduleState(code);
        break;
      case 'finish':
        rooms.finish(code, playerId, message.correct, message.waves);
        flushState(code);
        break;
      case 'again':
        rooms.again(code, playerId);
        flushState(code);
        break;
    }
  }

  function allowed(conn: Conn): boolean {
    const t = now();
    if (t - conn.windowStart > RATE_WINDOW_MS) {
      conn.windowStart = t;
      conn.count = 0;
    }
    conn.count += 1;
    return conn.count <= RATE_LIMIT;
  }

  wss.on('connection', (ws: WebSocket) => {
    const conn: Conn = { ws, code: null, playerId: null, alive: true, count: 0, windowStart: now() };
    conns.add(conn);

    ws.on('pong', () => (conn.alive = true));

    ws.on('message', (raw) => {
      if (!allowed(conn)) {
        send(conn, { type: 'error', code: 'mensaje-invalido', message: 'demasiados mensajes' });
        ws.close(1008, 'rate limit');
        return;
      }
      try {
        handle(conn, parseClientMessage(raw.toString()));
      } catch (err) {
        if (err instanceof RoomError) send(conn, { type: 'error', code: err.code, message: err.message });
        else {
          console.error('ws:', err);
          send(conn, { type: 'error', code: 'mensaje-invalido', message: 'error inesperado' });
        }
      }
    });

    ws.on('close', () => {
      conns.delete(conn);
      detach(conn);
    });
    ws.on('error', () => {
      conns.delete(conn);
      detach(conn);
    });
  });

  // Una pestaña cerrada de golpe no siempre cierra el socket: sin esto la sala
  // se quedaría con jugadores fantasma ocupando sitio.
  const heartbeat = setInterval(() => {
    for (const conn of conns) {
      if (!conn.alive) {
        conn.ws.terminate();
        continue;
      }
      conn.alive = false;
      conn.ws.ping();
    }
  }, HEARTBEAT_MS);
  heartbeat.unref?.();

  return () => {
    clearInterval(heartbeat);
    for (const timer of pending.values()) clearTimeout(timer);
    pending.clear();
    wss.close();
  };
}
