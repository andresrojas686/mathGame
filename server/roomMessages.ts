import { normalize } from './rooms.js';
import { ROOM_CODE_LENGTH, RoomError, type ClientMessage } from './roomTypes.js';
import { MAX_SCORE_VALUE } from './types.js';
import { isLevel, isOperation, sanitizeName } from './validation.js';

const MAX_TRAINER_LENGTH = 32;

function trainerId(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  // Solo lo que usan los ids de config/trainers.ts; cualquier otra cosa se descarta.
  return raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, MAX_TRAINER_LENGTH);
}

function count(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) throw new RoomError('mensaje-invalido', 'contador inválido');
  return Math.min(Math.max(Math.trunc(raw), 0), MAX_SCORE_VALUE);
}

function code(raw: unknown): string {
  if (typeof raw !== 'string') throw new RoomError('mensaje-invalido', 'código inválido');
  const value = normalize(raw);
  if (value.length !== ROOM_CODE_LENGTH) throw new RoomError('sala-no-existe', 'ese código no tiene el formato de una sala');
  return value;
}

/** El cliente no es confiable: cada campo se valida antes de tocar una sala. */
export function parseClientMessage(raw: unknown): ClientMessage {
  let body: unknown = raw;
  if (typeof raw === 'string') {
    try {
      body = JSON.parse(raw);
    } catch {
      throw new RoomError('mensaje-invalido', 'JSON inválido');
    }
  }
  if (!body || typeof body !== 'object') throw new RoomError('mensaje-invalido', 'mensaje inválido');
  const m = body as Record<string, unknown>;

  switch (m.type) {
    case 'create': {
      if (!isLevel(m.level)) throw new RoomError('mensaje-invalido', 'nivel inválido');
      if (!isOperation(m.operation)) throw new RoomError('mensaje-invalido', 'operación inválida');
      return { type: 'create', name: name(m.name), trainer: trainerId(m.trainer), level: m.level, operation: m.operation };
    }
    case 'join':
      return { type: 'join', code: code(m.code), name: name(m.name), trainer: trainerId(m.trainer) };
    case 'start':
      return { type: 'start' };
    case 'progress':
      return { type: 'progress', correct: count(m.correct), waves: count(m.waves) };
    case 'finish':
      return { type: 'finish', correct: count(m.correct), waves: count(m.waves) };
    case 'again':
      return { type: 'again' };
    case 'ping':
      return { type: 'ping' };
    default:
      throw new RoomError('mensaje-invalido', 'tipo de mensaje desconocido');
  }
}

function name(raw: unknown): string {
  try {
    return sanitizeName(raw);
  } catch {
    throw new RoomError('mensaje-invalido', 'nombre inválido');
  }
}
