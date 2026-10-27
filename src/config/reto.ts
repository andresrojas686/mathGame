import type { DifficultyConfig, DifficultyId } from '../types';
import { DIFFICULTIES } from './difficulties';

/** Reto memoria: segundos para responder, siempre iguales (no bajan con las oleadas). */
export const RETO_TIME = 7;

/** Reto memoria: segundos que se muestra cada operación del calentamiento. */
export const RETO_MEMORIZE_TIME = 3;

/** Reto memoria: cuántas operaciones hacia atrás hay que responder en cada nivel. */
export const RETO_BACK: Record<DifficultyId, number> = { facil: 1, normal: 2, dificil: 3 };

/**
 * Cifras del reto, iguales en los tres niveles: lo difícil es recordar, no calcular.
 * Suma y resta de 1 o 2 cifras; multiplicación y división con un factor o divisor de 1 cifra.
 * Corazones y vida del monstruo siguen siendo los del nivel.
 */
export function retoConfig(level: DifficultyId): DifficultyConfig {
  return {
    ...DIFFICULTIES[level],
    multiplicandDigits: [1, 2],
    multiplierDigits: [1],
    dividendDigits: [1, 2],
    divisorDigits: [1],
    addendDigits: [1, 2],
    minuendDigits: [1, 2],
    subtrahendDigits: [1, 2],
  };
}
