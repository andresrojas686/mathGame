import type { DifficultyId, Operation } from '../../types';

/** Espejo de server/roomTypes.ts. Se duplica a propósito: el cliente no importa del servidor. */
export const MAX_ROOM_PLAYERS = 50;
export const ROOM_CODE_LENGTH = 5;

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
  level: DifficultyId;
  operation: Operation;
  state: RoomState;
  hostId: string;
  seed: number;
  players: RoomPlayerView[];
}

export type ClientMessage =
  | { type: 'create'; name: string; trainer: string; level: DifficultyId; operation: Operation }
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
  | { type: 'error'; code: string; message: string }
  | { type: 'pong' };

/** Mismo alfabeto que el servidor: sin I ni O, que se confunden con 1 y 0 al dictarlas. */
export function isRoomCode(value: string): boolean {
  return new RegExp(`^[A-HJ-NP-Z2-9]{${ROOM_CODE_LENGTH}}$`).test(value);
}
