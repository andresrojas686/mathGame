import { censor } from './badwords.js';
import { LEVELS, MAX_NAME_LENGTH, MAX_SCORE_VALUE, OPERATIONS, type Level, type Operation, type ScoreInput } from './types.js';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') throw new ValidationError('name debe ser texto');
  const trimmed = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
  if (!trimmed) throw new ValidationError('name no puede estar vacío');
  return censor(trimmed);
}

function nonNegativeInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > MAX_SCORE_VALUE) {
    throw new ValidationError(`${field} debe ser un entero entre 0 y ${MAX_SCORE_VALUE}`);
  }
  return value;
}

export function isLevel(v: unknown): v is Level {
  return typeof v === 'string' && (LEVELS as readonly string[]).includes(v);
}

export function isOperation(v: unknown): v is Operation {
  return typeof v === 'string' && (OPERATIONS as readonly string[]).includes(v);
}

/** El cliente no es confiable ni siquiera cuando el usuario tiene ocho años. */
export function parseScoreInput(body: unknown): ScoreInput {
  if (!body || typeof body !== 'object') throw new ValidationError('cuerpo inválido');
  const b = body as Record<string, unknown>;
  if (!isLevel(b.level)) throw new ValidationError('level inválido');
  const operation = b.operation ?? 'multiplicar';
  if (!isOperation(operation)) throw new ValidationError('operation inválida');
  return {
    name: sanitizeName(b.name),
    level: b.level,
    operation,
    correct: nonNegativeInt(b.correct, 'correct'),
    waves: nonNegativeInt(b.waves, 'waves'),
  };
}
