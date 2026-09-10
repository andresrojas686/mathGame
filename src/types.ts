export type DifficultyId = 'facil' | 'normal' | 'dificil';

/** Operación de la partida. 'dividir' llega en Fase 4; el ranking ya la contempla. */
export type Operation = 'multiplicar' | 'dividir';

export interface DifficultyConfig {
  id: DifficultyId;
  hearts: number;
  /** Cantidad de dígitos posibles del multiplicando, ej. [2, 3]. Se sortea en cada operación. */
  multiplicandDigits: number[];
  /** Cantidad de dígitos posibles del multiplicador, ej. [1, 2]. */
  multiplierDigits: number[];
  /** División: cifras posibles del dividendo, ej. [2, 3]. */
  dividendDigits: number[];
  /** División: cifras posibles del divisor, ej. [1, 2]. Nunca más cifras que el dividendo. */
  divisorDigits: number[];
  /** Tiempo mínimo de respuesta en segundos. Es lo que hace posible una partida infinita. */
  timeFloor: number;
}

export interface Problem {
  /** Texto que ve el jugador: "347 × 26". */
  text: string;
  answer: number;
  operands: number[];
}

export interface HistoryEntry {
  problem: Problem;
  /** Respuesta que dio el jugador; null si se acabó el tiempo sin confirmar. */
  given: number | null;
  correct: boolean;
  /** Segundos usados desde que apareció la operación. */
  timeUsed: number;
}

/** Fuente de aleatoriedad inyectable: devuelve un número en [0, 1). */
export type Rng = () => number;

/** Datos que viajan de la selección de nivel al combate. */
export interface BattleParams {
  level: DifficultyId;
  operation: Operation;
  name: string;
  /** id de src/config/trainers.ts */
  trainer: string;
}

/** Datos que viajan del combate a la pantalla de resultado. */
export interface ResultParams extends BattleParams {
  correct: number;
  waves: number;
  history: HistoryEntry[];
  /** Nombres de los Pokémon derrotados, en orden. */
  defeated: string[];
}

/** Resumen de una operación que dio problemas, para la pantalla de resultado. */
export interface FailureSummary {
  problem: Problem;
  /** Respuestas incorrectas confirmadas. */
  misses: number;
  /** Veces que se agotó el tiempo con esta operación. */
  timeouts: number;
  /** Si al final se acertó. */
  solved: boolean;
}

export const MAX_NAME_LENGTH = 12;

// ---------- ranking ----------

export type BoardKey = `${Operation}:${DifficultyId}`;

export interface ScoreEntry {
  name: string;
  correct: number;
  waves: number;
  /** ISO 8601 */
  date: string;
}

export interface LeaderboardData {
  version: 2;
  boards: Record<BoardKey, ScoreEntry[]>;
}

export interface ScoreSubmission {
  name: string;
  level: DifficultyId;
  operation: Operation;
  correct: number;
  waves: number;
}

export type ScoreSource = 'server' | 'local';

export interface SubmitOutcome {
  entry: ScoreEntry;
  /** Posición real (1-based), aunque supere las 10 mostradas. */
  position: number;
  board: BoardKey;
  source: ScoreSource;
}

export function boardKey(operation: Operation, level: DifficultyId): BoardKey {
  return `${operation}:${level}`;
}
