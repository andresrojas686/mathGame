export type DifficultyId = 'facil' | 'normal' | 'dificil';

export interface DifficultyConfig {
  id: DifficultyId;
  hearts: number;
  /** Cantidad de dígitos posibles del multiplicando, ej. [2, 3]. Se sortea en cada operación. */
  multiplicandDigits: number[];
  /** Cantidad de dígitos posibles del multiplicador, ej. [1, 2]. */
  multiplierDigits: number[];
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
