import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY_IDS } from '../config/difficulties';
import { generateAdditionProblem, generateSubtractionProblem, sameProblem } from './ProblemGenerator';
import { seededRng } from './testRng';
import type { Problem } from '../types';

const digitsOf = (n: number) => String(n).length;

describe('generateAdditionProblem', () => {
  const expectedDigits = {
    facil: [1],
    normal: [1, 2],
    dificil: [2, 3, 4],
  } as const;

  for (const id of DIFFICULTY_IDS) {
    const cfg = DIFFICULTIES[id];
    const spec = expectedDigits[id];

    it(`${id}: sumas con las cifras del nivel en cada sumando (2000 muestras)`, () => {
      const rng = seededRng(21);
      let previous: Problem | undefined;
      for (let i = 0; i < 2000; i++) {
        const p = generateAdditionProblem(cfg, previous, rng);
        const [a, b] = p.operands as [number, number];
        expect(spec).toContain(digitsOf(a));
        expect(spec).toContain(digitsOf(b));
        expect(Math.min(a, b)).toBeGreaterThanOrEqual(2);
        expect(p.answer).toBe(a + b);
        expect(p.text).toBe(`${a} + ${b}`);
        expect(sameProblem(previous, p)).toBe(false);
        previous = p;
      }
    });
  }

  it('los sumandos se sortean por separado: aparecen todas las combinaciones de cifras', () => {
    const rng = seededRng(8);
    const seen = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const p = generateAdditionProblem(DIFFICULTIES.dificil, undefined, rng);
      seen.add(`${digitsOf(p.operands[0]!)}+${digitsOf(p.operands[1]!)}`);
    }
    expect(seen.size).toBe(9);
  });
});

describe('generateSubtractionProblem', () => {
  const expectedDigits = {
    facil: { minuend: 2, subtrahend: 1 },
    normal: { minuend: 3, subtrahend: 2 },
    dificil: { minuend: 4, subtrahend: 3 },
  } as const;

  for (const id of DIFFICULTY_IDS) {
    const cfg = DIFFICULTIES[id];
    const spec = expectedDigits[id];

    it(`${id}: ${spec.minuend} cifras − ${spec.subtrahend}, resultado ≥ 1 (2000 muestras)`, () => {
      const rng = seededRng(33);
      let previous: Problem | undefined;
      for (let i = 0; i < 2000; i++) {
        const p = generateSubtractionProblem(cfg, previous, rng);
        const [a, b] = p.operands as [number, number];
        expect(digitsOf(a)).toBe(spec.minuend);
        expect(digitsOf(b)).toBe(spec.subtrahend);
        expect(p.answer).toBe(a - b);
        expect(p.answer).toBeGreaterThanOrEqual(1);
        expect(p.text).toBe(`${a} − ${b}`);
        expect(sameProblem(previous, p)).toBe(false);
        previous = p;
      }
    });
  }

  it('si la configuración pide un sustraendo demasiado largo, lo acorta en vez de dar negativo', () => {
    const cfg = { ...DIFFICULTIES.facil, minuendDigits: [2], subtrahendDigits: [3] };
    const rng = seededRng(4);
    for (let i = 0; i < 200; i++) {
      const p = generateSubtractionProblem(cfg, undefined, rng);
      expect(digitsOf(p.operands[1]!)).toBe(1);
      expect(p.answer).toBeGreaterThanOrEqual(1);
    }
  });
});
