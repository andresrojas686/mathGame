import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../config/difficulties';
import { BattleState } from './BattleState';
import { generateProblemFor } from './ProblemGenerator';
import { mulberry32, seedFromString } from './seededRng';

function sequence(seed: number, count: number): number[] {
  const rng = mulberry32(seed);
  return Array.from({ length: count }, () => rng());
}

/** Lo que vería cada jugador de la sala: la lista de operaciones en orden. */
function problems(seed: number, count: number, operation: 'multiplicar' | 'dividir' = 'multiplicar'): string[] {
  const rng = mulberry32(seed);
  const cfg = DIFFICULTIES.normal;
  const out: string[] = [];
  let previous;
  for (let i = 0; i < count; i++) {
    previous = generateProblemFor(operation, cfg, previous, rng);
    out.push(previous.text);
  }
  return out;
}

describe('mulberry32', () => {
  it('devuelve siempre la misma secuencia para la misma semilla', () => {
    expect(sequence(12345, 5)).toEqual(sequence(12345, 5));
  });

  it('cambia con la semilla', () => {
    expect(sequence(1, 5)).not.toEqual(sequence(2, 5));
  });

  it('se mantiene dentro de [0, 1)', () => {
    for (const v of sequence(99, 500)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('partidas con semilla compartida', () => {
  it('dos jugadores con la misma semilla reciben las mismas operaciones', () => {
    expect(problems(777, 30)).toEqual(problems(777, 30));
    expect(problems(777, 30, 'dividir')).toEqual(problems(777, 30, 'dividir'));
  });

  it('con semillas distintas las operaciones difieren', () => {
    expect(problems(777, 30)).not.toEqual(problems(778, 30));
  });

  it('el estado de combate es reproducible aunque cada jugador acierte a su ritmo', () => {
    const run = (answerDelays: number[]): string[] => {
      const state = new BattleState(DIFFICULTIES.normal, 'multiplicar', mulberry32(4242));
      const seen: string[] = [];
      for (const delay of answerDelays) {
        seen.push(state.problem.text);
        // El retraso solo consume tiempo; no debe alterar qué operación toca.
        state.tick(delay);
        state.submit(state.problem.answer);
      }
      return seen;
    };
    expect(run([0.1, 0.2, 0.3, 1, 2])).toEqual(run([2, 1, 0.5, 0.2, 0.1]));
  });
});

describe('seedFromString', () => {
  it('es estable y distinta por texto', () => {
    expect(seedFromString('AB2CD')).toBe(seedFromString('AB2CD'));
    expect(seedFromString('AB2CD')).not.toBe(seedFromString('AB2CE'));
  });
});
