import type { DifficultyConfig, Problem, Rng } from '../types';

/** Entero uniforme en [min, max], ambos incluidos. */
export function randomInt(min: number, max: number, rng: Rng): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Número con exactamente `digits` cifras: de 10^(n-1) a 10^n − 1.
 * Para 1 cifra el mínimo es 2, porque 0 y 1 no enseñan nada y regalan el turno.
 */
export function randomWithDigits(digits: number, rng: Rng): number {
  const min = digits === 1 ? 2 : 10 ** (digits - 1);
  const max = 10 ** digits - 1;
  return randomInt(min, max, rng);
}

export function pick<T>(items: readonly T[], rng: Rng): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error('pick(): lista vacía');
  return item;
}

export function sameProblem(a: Problem | undefined, b: Problem): boolean {
  if (!a) return false;
  return a.operands.length === b.operands.length && a.operands.every((v, i) => v === b.operands[i]);
}

function buildProblem(cfg: DifficultyConfig, rng: Rng): Problem {
  const a = randomWithDigits(pick(cfg.multiplicandDigits, rng), rng);
  const b = randomWithDigits(pick(cfg.multiplierDigits, rng), rng);
  return { text: `${a} × ${b}`, answer: a * b, operands: [a, b] };
}

/**
 * Genera una multiplicación para el nivel. Nunca repite la operación anterior.
 * `rng` es inyectable para pruebas deterministas.
 */
export function generateProblem(cfg: DifficultyConfig, previous?: Problem, rng: Rng = Math.random): Problem {
  let problem = buildProblem(cfg, rng);
  // Con rangos de al menos 8 valores la repetición es rara; el bucle acotado evita
  // colgarse si alguien configura un nivel degenerado.
  for (let i = 0; i < 20 && sameProblem(previous, problem); i++) {
    problem = buildProblem(cfg, rng);
  }
  return problem;
}
