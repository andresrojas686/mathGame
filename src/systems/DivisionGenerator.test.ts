import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY_IDS } from '../config/difficulties';
import { generateDivisionProblem, quotientRange, sameProblem } from './ProblemGenerator';
import { seededRng } from './testRng';
import type { Problem } from '../types';

const digitsOf = (n: number) => String(n).length;

describe('quotientRange', () => {
  it('devuelve los cocientes cuyo producto tiene exactamente las cifras pedidas', () => {
    expect(quotientRange(7, 2)).toEqual({ min: 2, max: 14 }); // 14..98
    expect(quotientRange(12, 2)).toEqual({ min: 2, max: 8 }); // 24..96
    expect(quotientRange(50, 3)).toEqual({ min: 2, max: 19 }); // 100..950
  });
  it('es nulo cuando no existe cociente ≥ 2', () => {
    expect(quotientRange(99, 2)).toBeNull(); // 198 ya tiene 3 cifras
    expect(quotientRange(500, 3)).toBeNull(); // 1000 ya tiene 4 cifras
  });
});

describe('generateDivisionProblem', () => {
  const expectedDigits = {
    facil: { dividend: [2], divisor: [1] },
    normal: { dividend: [2, 3], divisor: [1, 2] },
    dificil: { dividend: [2, 3, 4], divisor: [1, 2, 3] },
  } as const;

  for (const id of DIFFICULTY_IDS) {
    const cfg = DIFFICULTIES[id];
    const spec = expectedDigits[id];

    it(`${id}: divisiones exactas con las cifras del nivel, divisor ≥ 2, cociente ≥ 2 (2000 muestras)`, () => {
      const rng = seededRng(99);
      let previous: Problem | undefined;
      for (let i = 0; i < 2000; i++) {
        const p = generateDivisionProblem(cfg, previous, rng);
        const [dividend, divisor] = p.operands as [number, number];
        expect(spec.dividend).toContain(digitsOf(dividend));
        expect(spec.divisor).toContain(digitsOf(divisor));
        expect(digitsOf(divisor)).toBeLessThanOrEqual(digitsOf(dividend));
        expect(divisor).toBeGreaterThanOrEqual(2);
        expect(dividend % divisor).toBe(0);
        expect(p.answer).toBe(dividend / divisor);
        expect(p.answer).toBeGreaterThanOrEqual(2);
        expect(p.text).toBe(`${dividend} ÷ ${divisor}`);
        expect(sameProblem(previous, p)).toBe(false);
        previous = p;
      }
    });
  }

  it('normal y difícil producen todas las combinaciones de cifras posibles', () => {
    const cfg = DIFFICULTIES.dificil;
    const rng = seededRng(5);
    const seen = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const p = generateDivisionProblem(cfg, undefined, rng);
      seen.add(`${digitsOf(p.operands[0]!)}/${digitsOf(p.operands[1]!)}`);
    }
    // 2/1, 2/2, 3/1, 3/2, 3/3, 4/1, 4/2, 4/3 → 8 combinaciones válidas (divisor ≤ dividendo)
    expect([...seen].sort()).toEqual(['2/1', '2/2', '3/1', '3/2', '3/3', '4/1', '4/2', '4/3']);
  });

  it('nunca produce 2 cifras entre 3 cifras en difícil', () => {
    const cfg = DIFFICULTIES.dificil;
    const rng = seededRng(11);
    for (let i = 0; i < 1000; i++) {
      const p = generateDivisionProblem(cfg, undefined, rng);
      expect(digitsOf(p.operands[1]!)).toBeLessThanOrEqual(digitsOf(p.operands[0]!));
    }
  });
});
