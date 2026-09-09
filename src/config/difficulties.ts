import type { DifficultyConfig, DifficultyId } from '../types';

/** Tiempo de respuesta en la primera oleada, en segundos. */
export const INITIAL_TIME = 7;

/** Segundos que se restan por cada oleada superada, hasta llegar al piso del nivel. */
export const TIME_STEP_PER_WAVE = 0.5;

export const DIFFICULTIES: Record<DifficultyId, DifficultyConfig> = {
  facil: {
    id: 'facil',
    hearts: 5,
    multiplicandDigits: [2],
    multiplierDigits: [1],
    timeFloor: 5,
  },
  normal: {
    id: 'normal',
    hearts: 3,
    multiplicandDigits: [2, 3],
    multiplierDigits: [1, 2],
    timeFloor: 4,
  },
  dificil: {
    id: 'dificil',
    hearts: 1,
    multiplicandDigits: [3, 4, 5],
    multiplierDigits: [1, 2, 3],
    timeFloor: 3.5,
  },
};

export const DIFFICULTY_IDS: DifficultyId[] = ['facil', 'normal', 'dificil'];

export function isDifficultyId(value: unknown): value is DifficultyId {
  return typeof value === 'string' && (DIFFICULTY_IDS as string[]).includes(value);
}

/**
 * Tiempo de respuesta para una oleada dada (1-based), según la tabla de plan.md §3:
 * oleada 1 = 7.0 s, 2 = 6.5 s, 3 = 6.0 s, ... con piso por nivel.
 */
export function timeLimitForWave(wave: number, cfg: DifficultyConfig): number {
  const raw = INITIAL_TIME - TIME_STEP_PER_WAVE * (wave - 1);
  return Math.max(raw, cfg.timeFloor);
}
