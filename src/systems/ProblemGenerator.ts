import type { DifficultyConfig, Operation, Problem, Rng } from '../types';

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

function withoutRepeat(build: () => Problem, previous: Problem | undefined): Problem {
  let problem = build();
  // Con rangos de al menos 8 valores la repetición es rara; el bucle acotado evita
  // colgarse si alguien configura un nivel degenerado.
  for (let i = 0; i < 20 && sameProblem(previous, problem); i++) problem = build();
  return problem;
}

/**
 * Genera una multiplicación para el nivel. Nunca repite la operación anterior.
 * `rng` es inyectable para pruebas deterministas.
 */
export function generateProblem(cfg: DifficultyConfig, previous?: Problem, rng: Rng = Math.random): Problem {
  return withoutRepeat(() => buildProblem(cfg, rng), previous);
}

/** Rango de cocientes q ≥ 2 tales que q·b tiene exactamente `dividendDigits` cifras. Vacío si no existe. */
export function quotientRange(divisor: number, dividendDigits: number): { min: number; max: number } | null {
  const lo = 10 ** (dividendDigits - 1);
  const hi = 10 ** dividendDigits - 1;
  const min = Math.max(2, Math.ceil(lo / divisor));
  const max = Math.floor(hi / divisor);
  return max >= min ? { min, max } : null;
}

function buildDivision(cfg: DifficultyConfig, rng: Rng): Problem {
  const dividendDigits = pick(cfg.dividendDigits, rng);
  // El divisor nunca tiene más cifras que el dividendo.
  const allowed = cfg.divisorDigits.filter((d) => d <= dividendDigits);
  const divisorDigits = pick(allowed.length ? allowed : [Math.min(...cfg.divisorDigits)], rng);

  // Algunos divisores concretos no admiten cociente (ej. 2 cifras entre 99): se vuelve a sortear.
  for (let i = 0; i < 50; i++) {
    const b = randomWithDigits(divisorDigits, rng);
    const range = quotientRange(b, dividendDigits);
    if (!range) continue;
    const q = randomInt(range.min, range.max, rng);
    return { text: `${q * b} ÷ ${b}`, answer: q, operands: [q * b, b] };
  }
  // Último recurso, siempre válido: el divisor mínimo de esas cifras.
  const b = divisorDigits === 1 ? 2 : 10 ** (divisorDigits - 1);
  const range = quotientRange(b, dividendDigits) ?? { min: 2, max: 2 };
  const q = randomInt(range.min, range.max, rng);
  return { text: `${q * b} ÷ ${b}`, answer: q, operands: [q * b, b] };
}

/**
 * Genera una división exacta para el nivel: `q·b ÷ b`, respuesta `q ≥ 2`, con las cifras
 * del dividendo y del divisor definidas en la configuración. Nunca repite la operación anterior.
 */
export function generateDivisionProblem(cfg: DifficultyConfig, previous?: Problem, rng: Rng = Math.random): Problem {
  return withoutRepeat(() => buildDivision(cfg, rng), previous);
}

export function generateProblemFor(operation: Operation, cfg: DifficultyConfig, previous?: Problem, rng: Rng = Math.random): Problem {
  return operation === 'dividir' ? generateDivisionProblem(cfg, previous, rng) : generateProblem(cfg, previous, rng);
}
