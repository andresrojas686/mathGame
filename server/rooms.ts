import { MAX_SCORE_VALUE, type Level, type Operation } from './types.js';
import {
  COUNTDOWN_MS,
  MAX_ROOMS,
  MAX_ROOM_PLAYERS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_IDLE_MS,
  RoomError,
  type RoomPlayerView,
  type RoomState,
  type RoomSummary,
  type RoomView,
} from './roomTypes.js';

export interface RoomPlayer {
  id: string;
  name: string;
  trainer: string;
  correct: number;
  waves: number;
  finished: boolean;
  connected: boolean;
  joinedAt: number;
}

export interface Room {
  code: string;
  level: Level;
  operation: Operation;
  state: RoomState;
  hostId: string;
  seed: number;
  players: Map<string, RoomPlayer>;
  createdAt: number;
  lastActivity: number;
}

export interface JoinInput {
  name: string;
  trainer: string;
}

export interface CreateInput extends JoinInput {
  level: Level;
  operation: Operation;
}

export interface RoomHandle {
  room: Room;
  playerId: string;
}

export interface RoomOptions {
  now?: () => number;
  random?: () => number;
  maxRooms?: number;
  maxPlayers?: number;
}

/**
 * Salas en memoria. Deliberadamente sin persistencia: una sala vive lo que dura la
 * partida, y si el servidor se reinicia nadie espera recuperarla. El ranking, que sí
 * importa a largo plazo, sigue en data/scores.json.
 *
 * Esta clase no sabe nada de WebSockets para poder probarla sin abrir un puerto.
 */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly maxRooms: number;
  private readonly maxPlayers: number;

  constructor(opts: RoomOptions = {}) {
    this.now = opts.now ?? (() => Date.now());
    this.random = opts.random ?? Math.random;
    this.maxRooms = opts.maxRooms ?? MAX_ROOMS;
    this.maxPlayers = opts.maxPlayers ?? MAX_ROOM_PLAYERS;
  }

  get size(): number {
    return this.rooms.size;
  }

  create(input: CreateInput): RoomHandle {
    if (this.rooms.size >= this.maxRooms) {
      throw new RoomError('limite-salas', 'hay demasiadas salas abiertas, inténtalo en un rato');
    }
    const now = this.now();
    const code = this.freshCode();
    const host = this.newPlayer(input, now);
    const room: Room = {
      code,
      level: input.level,
      operation: input.operation,
      state: 'lobby',
      hostId: host.id,
      seed: this.newSeed(),
      players: new Map([[host.id, host]]),
      createdAt: now,
      lastActivity: now,
    };
    this.rooms.set(code, room);
    return { room, playerId: host.id };
  }

  join(code: string, input: JoinInput): RoomHandle {
    const room = this.require(code);
    if (room.state !== 'lobby') throw new RoomError('partida-en-curso', 'la partida de esa sala ya empezó');
    if (room.players.size >= this.maxPlayers) throw new RoomError('sala-llena', `la sala ya tiene ${this.maxPlayers} jugadores`);
    const player = this.newPlayer(input, this.now());
    room.players.set(player.id, player);
    this.touch(room);
    return { room, playerId: player.id };
  }

  /** Arranca la partida. Solo el anfitrión, y solo desde el lobby. */
  start(code: string, playerId: string): Room {
    const room = this.require(code);
    if (room.hostId !== playerId) throw new RoomError('no-eres-anfitrion', 'solo quien creó la sala puede empezar');
    if (room.state !== 'lobby') throw new RoomError('estado-invalido', 'la partida ya empezó');
    room.state = 'playing';
    for (const p of room.players.values()) {
      p.correct = 0;
      p.waves = 0;
      p.finished = false;
    }
    this.touch(room);
    return room;
  }

  /** Marcador en vivo. Los valores nunca bajan: un cliente retrasado no borra el progreso. */
  progress(code: string, playerId: string, correct: number, waves: number): Room {
    const room = this.require(code);
    const player = this.requirePlayer(room, playerId);
    if (room.state !== 'playing' || player.finished) return room;
    player.correct = Math.max(player.correct, clampScore(correct));
    player.waves = Math.max(player.waves, clampScore(waves));
    this.touch(room);
    return room;
  }

  finish(code: string, playerId: string, correct: number, waves: number): Room {
    const room = this.require(code);
    const player = this.requirePlayer(room, playerId);
    if (room.state === 'lobby') return room;
    player.correct = Math.max(player.correct, clampScore(correct));
    player.waves = Math.max(player.waves, clampScore(waves));
    player.finished = true;
    this.settle(room);
    this.touch(room);
    return room;
  }

  /** Nueva ronda con la misma gente: vuelve al lobby con otra semilla. */
  again(code: string, playerId: string): Room {
    const room = this.require(code);
    if (room.hostId !== playerId) throw new RoomError('no-eres-anfitrion', 'solo quien creó la sala puede repetir');
    if (room.state === 'playing') throw new RoomError('estado-invalido', 'la partida sigue en curso');
    room.state = 'lobby';
    room.seed = this.newSeed();
    for (const p of room.players.values()) {
      p.correct = 0;
      p.waves = 0;
      p.finished = false;
    }
    // Quien se desconectó durante la partida anterior no arrastra su sitio a la nueva.
    for (const [id, p] of [...room.players]) if (!p.connected) room.players.delete(id);
    this.touch(room);
    return room;
  }

  /**
   * Salida de un jugador. En el lobby desaparece de la lista; en partida se queda con
   * su puntaje congelado, porque cerrar la pestaña no debería dejar a los demás esperando.
   */
  leave(code: string, playerId: string): Room | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    const player = room.players.get(playerId);
    if (!player) return room;

    player.connected = false;
    if (room.state === 'lobby') room.players.delete(playerId);
    else player.finished = true;

    if ([...room.players.values()].every((p) => !p.connected)) {
      this.rooms.delete(code);
      return null;
    }
    if (room.hostId === playerId) {
      const next = [...room.players.values()].find((p) => p.connected);
      if (next) room.hostId = next.id;
    }
    this.settle(room);
    this.touch(room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(normalize(code));
  }

  summary(code: string): RoomSummary | null {
    const room = this.get(code);
    if (!room) return null;
    return {
      code: room.code,
      state: room.state,
      level: room.level,
      operation: room.operation,
      players: room.players.size,
      max: this.maxPlayers,
    };
  }

  /** Descarta salas abandonadas. Se llama desde un intervalo en index.ts. */
  prune(idleMs = ROOM_IDLE_MS): number {
    const limit = this.now() - idleMs;
    let removed = 0;
    for (const [code, room] of this.rooms) {
      const empty = room.players.size === 0 || [...room.players.values()].every((p) => !p.connected);
      if (empty || room.lastActivity < limit) {
        this.rooms.delete(code);
        removed += 1;
      }
    }
    return removed;
  }

  // ---------- internos ----------

  private settle(room: Room): void {
    if (room.state !== 'playing') return;
    const players = [...room.players.values()];
    if (players.length > 0 && players.every((p) => p.finished)) room.state = 'ended';
  }

  private require(code: string): Room {
    const room = this.rooms.get(normalize(code));
    if (!room) throw new RoomError('sala-no-existe', 'esa sala no existe o ya se cerró');
    return room;
  }

  private requirePlayer(room: Room, playerId: string): RoomPlayer {
    const player = room.players.get(playerId);
    if (!player) throw new RoomError('sin-sala', 'no estás en esa sala');
    return player;
  }

  private newPlayer(input: JoinInput, now: number): RoomPlayer {
    return {
      id: this.id(16),
      name: input.name,
      trainer: input.trainer,
      correct: 0,
      waves: 0,
      finished: false,
      connected: true,
      joinedAt: now,
    };
  }

  private touch(room: Room): void {
    room.lastActivity = this.now();
  }

  private freshCode(): string {
    for (let i = 0; i < 50; i++) {
      const code = this.code();
      if (!this.rooms.has(code)) return code;
    }
    throw new RoomError('limite-salas', 'no se pudo generar un código libre');
  }

  private code(): string {
    let out = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      out += ROOM_CODE_ALPHABET[Math.floor(this.random() * ROOM_CODE_ALPHABET.length)] ?? 'A';
    }
    return out;
  }

  private id(length: number): string {
    let out = '';
    while (out.length < length) out += Math.floor(this.random() * 0xffffffff).toString(16);
    return out.slice(0, length);
  }

  private newSeed(): number {
    return Math.floor(this.random() * 0xffffffff) >>> 0;
  }
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.trunc(value), 0), MAX_SCORE_VALUE);
}

export function normalize(code: string): string {
  return code.trim().toUpperCase();
}

/** Orden del marcador: más aciertos, luego más oleadas, luego quien entró antes. */
export function compareRoomPlayers(a: RoomPlayer, b: RoomPlayer): number {
  return b.correct - a.correct || b.waves - a.waves || a.joinedAt - b.joinedAt;
}

export function playerView(p: RoomPlayer): RoomPlayerView {
  return { id: p.id, name: p.name, trainer: p.trainer, correct: p.correct, waves: p.waves, finished: p.finished, connected: p.connected };
}

export function roomView(room: Room): RoomView {
  return {
    code: room.code,
    level: room.level,
    operation: room.operation,
    state: room.state,
    hostId: room.hostId,
    seed: room.seed,
    players: [...room.players.values()].sort(compareRoomPlayers).map(playerView),
  };
}

export { COUNTDOWN_MS };
