import type { Level, Operation } from './types.js';

/** Tope de jugadores por sala. Por encima el ranking en vivo deja de ser legible. */
export const MAX_ROOM_PLAYERS = 50;
/** Salas vivas a la vez en el proceso. Evita que un bucle de creación agote la memoria. */
export const MAX_ROOMS = 200;
/** Letras y dígitos sin parejas ambiguas (sin O/0, I/1): el código se dicta en voz alta. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;
/** Cuenta atrás que ve cada jugador antes de la primera operación. */
export const COUNTDOWN_MS = 3000;
/** Una sala sin actividad se descarta pasado este tiempo. */
export const ROOM_IDLE_MS = 2 * 60 * 60 * 1000;

export type RoomState = 'lobby' | 'playing' | 'ended';

export interface RoomPlayerView {
  id: string;
  name: string;
  trainer: string;
  correct: number;
  waves: number;
  finished: boolean;
  connected: boolean;
}

export interface RoomView {
  code: string;
  level: Level;
  operation: Operation;
  state: RoomState;
  hostId: string;
  /** Semilla compartida: todos resuelven exactamente las mismas operaciones. */
  seed: number;
  players: RoomPlayerView[];
}

/** Resumen público de una sala, para saber si un enlace sigue vivo antes de conectarse. */
export interface RoomSummary {
  code: string;
  state: RoomState;
  level: Level;
  operation: Operation;
  players: number;
  max: number;
}

export type RoomErrorCode =
  | 'sala-no-existe'
  | 'sala-llena'
  | 'partida-en-curso'
  | 'no-eres-anfitrion'
  | 'estado-invalido'
  | 'sin-sala'
  | 'mensaje-invalido'
  | 'limite-salas';

export class RoomError extends Error {
  constructor(
    readonly code: RoomErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RoomError';
  }
}

export type ClientMessage =
  | { type: 'create'; name: string; trainer: string; level: Level; operation: Operation }
  | { type: 'join'; code: string; name: string; trainer: string }
  | { type: 'start' }
  | { type: 'progress'; correct: number; waves: number }
  | { type: 'finish'; correct: number; waves: number }
  | { type: 'again' }
  | { type: 'ping' };

export type ServerMessage =
  | { type: 'welcome'; playerId: string; room: RoomView }
  | { type: 'room'; room: RoomView }
  | { type: 'started'; room: RoomView; countdownMs: number }
  | { type: 'error'; code: RoomErrorCode; message: string }
  | { type: 'pong' };
