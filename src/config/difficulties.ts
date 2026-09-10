import type { DifficultyConfig, DifficultyId } from '../types';

/** Tiempo de respuesta en la primera oleada, en segundos. */
export const INITIAL_TIME = 7;

/** Segundos que se restan por cada oleada superada, hasta llegar al piso del nivel. */
export const TIME_STEP_PER_WAVE = 0.5;

export const DIFFICULTIES: Record<DifficultyId, DifficultyConfig> = {
  facil: {
    id: 'facil',
    hearts: 10,
    multiplicandDigits: [1],
    multiplierDigits: [1],
    dividendDigits: [2],
    divisorDigits: [1],
    timeFloor: 15,
  },
  normal: {
    id: 'normal',
    hearts: 5,
    multiplicandDigits: [2],
    multiplierDigits: [1, 2],
    dividendDigits: [2, 3],
    divisorDigits: [1, 2],
    timeFloor: 12,
  },
  dificil: {
    id: 'dificil',
    hearts: 3,
    multiplicandDigits: [3, 4, 5],
    multiplierDigits: [1, 2],
    dividendDigits: [2, 3, 4],
    divisorDigits: [1, 2, 3],
    timeFloor: 9,
  },
};

export const DIFFICULTY_IDS: DifficultyId[] = ['facil', 'normal', 'dificil'];

export function isDifficultyId(value: unknown): value is DifficultyId {
  return typeof value === 'string' && (DIFFICULTY_IDS as string[]).includes(value);
}

/**
 * Tiempo de respuesta para una oleada dada (1-based), según la tabla de plan.md §3:
 * oleada 1 = 7.0 s, 2 = 6.5 s, 3 = 6.0 s, ... con piso por nivel.
 * Si el piso del nivel supera INITIAL_TIME, el tiempo queda fijo en el piso.
 */
export function timeLimitForWave(wave: number, cfg: DifficultyConfig): number {
  const raw = INITIAL_TIME - TIME_STEP_PER_WAVE * (wave - 1);
  return Math.max(raw, cfg.timeFloor);
}

/** Vida del monstruo por oleada (plan.md §3): 5, 7, 9, ... = 3 + 2n. */
export function monsterHpForWave(wave: number): number {
  return 3 + 2 * wave;
}

/** Datos de presentación de cada nivel para la pantalla de selección. Los temas visuales llegan en Fase 4. */
export const DIFFICULTY_LABELS: Record<DifficultyId, { title: string; theme: string }> = {
  facil: { title: 'Fácil', theme: 'Gimnasio de roca y planta' },
  normal: { title: 'Normal', theme: 'Gimnasio de agua y eléctrico' },
  dificil: { title: 'Difícil', theme: 'Gimnasio psíquico y fantasma' },
};
