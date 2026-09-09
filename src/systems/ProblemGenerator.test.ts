import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY_IDS } from '../config/difficulties';
import { generateProblem, randomWithDigits, sameProblem } from './ProblemGenerator';
import { seededRng } from './testRng';
import type { Problem } from '../types';

const digitsOf = (n: number) => String(n).length;

describe('randomWithDigits', () => {
  it('produce exactamente n cifras, nunca con ceros a la izquierda', () => {
    const rng = seededRng(1);
    for (const n of [1, 2, 3, 4, 5]) {
      for (let i = 0; i < 500; i++) {
        const v = randomWithDigits(n, rng);
        expect(digitsOf(v)).toBe(n);
      }
    }
  });

  it('con 1 cifra nunca devuelve 0 ni 1', () => {
    const rng = seededRng(2);
    for (let i = 0; i < 1000; i++) {
      expect(randomWithDigits(1, rng)).toBeGreaterThanOrEqual(2);
    }
  });

  it('cubre los extremos del rango', () => {
    expect(randomWithDigits(3, () => 0)).toBe(100);
    expect(randomWithDigits(3, () => 0.999999)).toBe(999);
    expect(randomWithDigits(1, () => 0)).toBe(2);
    expect(randomWithDigits(1, () => 0.999999)).toBe(9);
  });
});

describe('generateProblem', () => {
  for (const id of DIFFICULTY_IDS) {
    const cfg = DIFFICULTIES[id];

    it(`${id}: respeta los dígitos permitidos y answer === a × b (1000 muestras)`, () => {
      const rng = seededRng(42);
      let previous: Problem | undefined;
      for (let i = 0; i < 1000; i++) {
        const p = generateProblem(cfg, previous, rng);
        const [a, b] = p.operands;
        expect(a).toBeDefined();
        expect(b).toBeDefined();
        expect(cfg.multiplicandDigits).toContain(digitsOf(a!));
        expect(cfg.multiplierDigits).toContain(digitsOf(b!));
        expect(b!).toBeGreaterThanOrEqual(2);
        expect(p.answer).toBe(a! * b!);
        expect(p.text).toBe(`${a} × ${b}`);
        expect(sameProblem(previous, p)).toBe(false);
        previous = p;
      }
    });
  }

  it('en normal y difícil aparecen todas las combinaciones de dígitos', () => {
    const cfg = DIFFICULTIES.dificil;
    const rng = seededRng(7);
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const p = generateProblem(cfg, undefined, rng);
      seen.add(`${digitsOf(p.operands[0]!)}x${digitsOf(p.operands[1]!)}`);
    }
    expect(seen.size).toBe(cfg.multiplicandDigits.length * cfg.multiplierDigits.length);
  });

  it('no repite la operación anterior aunque el rng insista', () => {
    // rng constante: siempre produciría el mismo problema si no se evitara.
    let calls = 0;
    const rng = () => {
      calls += 1;
      // Las primeras 4 llamadas (pick, a, pick, b) reproducen el problema anterior; luego cambia.
      return calls <= 4 ? 0 : 0.5;
    };
    const cfg = DIFFICULTIES.facil;
    const first = generateProblem(cfg, undefined, () => 0);
    const second = generateProblem(cfg, first, rng);
    expect(sameProblem(first, second)).toBe(false);
  });
});
