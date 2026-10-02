import type { DifficultyId, Operation } from '../../types';
import type { ClientMessage, RoomPlayerView, RoomView, ServerMessage } from './protocol';

export interface RoomErrorInfo {
  code: string;
  message: string;
}

export type RoomEvent =
  | { type: 'room'; room: RoomView }
  | { type: 'started'; room: RoomView; countdownMs: number }
  | { type: 'error'; error: RoomErrorInfo }
  | { type: 'closed' };

type Listener = (event: RoomEvent) => void;

/** Los avances se mandan agrupados: una partida rápida genera más eventos que los que hace falta enviar. */
const PROGRESS_INTERVAL_MS = 250;
const CONNECT_TIMEOUT_MS = 8000;

function defaultUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

/**
 * Conexión con las salas del servidor. Mantiene el último estado recibido para que
 * cualquier escena pueda pintarlo sin pedirlo, y reenvía cada cambio a quien escuche.
 *
 * No hay reconexión automática: si el socket se cae en mitad de la partida el servidor
 * congela el puntaje de ese jugador, y fingir que sigue dentro sería mentirle al resto.
 */
export class RoomClient {
  room: RoomView | null = null;
  playerId: string | null = null;
  lastError: RoomErrorInfo | null = null;

  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private queue: ClientMessage[] = [];
  private lastProgressAt = 0;
  private progressTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingProgress: { correct: number; waves: number } | null = null;

  constructor(private readonly url: string = '') {}

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get me(): RoomPlayerView | null {
    if (!this.room || !this.playerId) return null;
    return this.room.players.find((p) => p.id === this.playerId) ?? null;
  }

  get isHost(): boolean {
    return Boolean(this.room && this.playerId && this.room.hostId === this.playerId);
  }

  /** Posición (1-based) en el marcador de la sala. */
  get position(): number {
    if (!this.room || !this.playerId) return 0;
    return this.room.players.findIndex((p) => p.id === this.playerId) + 1;
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.ws) this.close();
    const ws = new WebSocket(this.url || defaultUrl());
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('el servidor no respondió')), CONNECT_TIMEOUT_MS);
      ws.addEventListener('open', () => {
        clearTimeout(timer);
        for (const msg of this.queue.splice(0)) ws.send(JSON.stringify(msg));
        resolve();
      });
      ws.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('no se pudo conectar con el servidor'));
      });
    });

    ws.addEventListener('message', (ev) => this.onMessage(ev.data));
    ws.addEventListener('close', () => {
      if (this.ws === ws) this.ws = null;
      this.emit({ type: 'closed' });
    });
  }

  async create(input: { name: string; trainer: string; level: DifficultyId; operation: Operation }): Promise<void> {
    await this.connect();
    this.send({ type: 'create', ...input });
  }

  async join(code: string, input: { name: string; trainer: string }): Promise<void> {
    await this.connect();
    this.send({ type: 'join', code: code.trim().toUpperCase(), ...input });
  }

  start(): void {
    this.send({ type: 'start' });
  }

  again(): void {
    this.send({ type: 'again' });
  }

  /** Marcador en vivo, agrupado: se manda como mucho uno cada PROGRESS_INTERVAL_MS. */
  progress(correct: number, waves: number): void {
    this.pendingProgress = { correct, waves };
    const now = Date.now();
    const wait = Math.max(0, PROGRESS_INTERVAL_MS - (now - this.lastProgressAt));
    if (this.progressTimer) return;
    this.progressTimer = setTimeout(() => {
      this.progressTimer = null;
      const p = this.pendingProgress;
      this.pendingProgress = null;
      if (!p) return;
      this.lastProgressAt = Date.now();
      this.send({ type: 'progress', ...p });
    }, wait);
  }

  finish(correct: number, waves: number): void {
    this.flushProgress();
    this.send({ type: 'finish', correct, waves });
  }

  /** Sale de la sala y cierra el socket. */
  leave(): void {
    this.close();
    this.room = null;
    this.playerId = null;
  }

  private flushProgress(): void {
    if (this.progressTimer) {
      clearTimeout(this.progressTimer);
      this.progressTimer = null;
    }
    this.pendingProgress = null;
  }

  private close(): void {
    this.flushProgress();
    const ws = this.ws;
    this.ws = null;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) ws.close();
  }

  private send(message: ClientMessage): void {
    if (this.connected) this.ws?.send(JSON.stringify(message));
    else this.queue.push(message);
  }

  private onMessage(raw: unknown): void {
    if (typeof raw !== 'string') return;
    let msg: ServerMessage;
    try {
      msg = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }

    switch (msg.type) {
      case 'welcome':
        this.playerId = msg.playerId;
        this.room = msg.room;
        this.lastError = null;
        this.emit({ type: 'room', room: msg.room });
        break;
      case 'room':
        this.room = msg.room;
        this.emit({ type: 'room', room: msg.room });
        break;
      case 'started':
        this.room = msg.room;
        this.emit({ type: 'started', room: msg.room, countdownMs: msg.countdownMs });
        break;
      case 'error':
        this.lastError = { code: msg.code, message: msg.message };
        this.emit({ type: 'error', error: this.lastError });
        break;
      case 'pong':
        break;
    }
  }

  private emit(event: RoomEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }
}

export const roomClient = new RoomClient();
