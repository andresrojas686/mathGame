export const LEVELS = ['facil', 'normal', 'dificil'] as const;
export const OPERATIONS = ['multiplicar', 'dividir'] as const;

export type Level = (typeof LEVELS)[number];
export type Operation = (typeof OPERATIONS)[number];

export const MAX_NAME_LENGTH = 12;
export const MAX_SCORE_VALUE = 10000;
/** Entradas conservadas por tabla en el archivo. Se muestran las 10 primeras. */
export const KEEP_PER_BOARD = 20;

export interface ScoreEntry {
  name: string;
  correct: number;
  waves: number;
  /** ISO 8601 */
  date: string;
}

export interface ScoreInput {
  name: string;
  level: Level;
  operation: Operation;
  correct: number;
  waves: number;
}

export type BoardKey = `${Operation}:${Level}`;

export interface ScoresFile {
  version: 2;
  boards: Record<BoardKey, ScoreEntry[]>;
}

export interface SubmitResult {
  entry: ScoreEntry;
  /** Posición real (1-based) en la tabla, aunque supere las que se conservan. */
  position: number;
  board: BoardKey;
}

export function boardKey(operation: Operation, level: Level): BoardKey {
  return `${operation}:${level}`;
}

export function emptyScoresFile(): ScoresFile {
  const boards = {} as Record<BoardKey, ScoreEntry[]>;
  for (const op of OPERATIONS) for (const lv of LEVELS) boards[boardKey(op, lv)] = [];
  return { version: 2, boards };
}
