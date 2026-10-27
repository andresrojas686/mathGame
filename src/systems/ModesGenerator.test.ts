import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY_IDS, timeLimitForWave } from '../config/difficulties';
import { isOperation, OPERATION_IDS, operationFor } from '../config/operations';
import { BattleState } from './BattleState';
import { generateProblemFor, sameProblem } from './ProblemGenerator';
import { seededRng } from './testRng';
import type { ArithOp, Problem } from '../types';

const digitsOf = (n: number) => String(n).length;

describe('operaciones y modos', () => {
  it('hay 9: cuatro clásicas, la mezcla y cuatro retos', () => {
    expect(OPERATION_IDS).toEqual([
      'multiplicar',
      'dividir',
      'sumar',
      'restar',
      'mezcla',
      'reto-multiplicar',
      'reto-dividir',
      'reto-sumar',
      'reto-restar',
    ]);
    expect(isOperation('reto-mezcla')).toBe(false);
  });

  it('operationFor combina modo y operación base', () => {
    expect(operationFor('clasico', 'sumar')).toBe('sumar');
    expect(operationFor('mezcla', 'sumar')).toBe('mezcla');
    expect(operationFor('reto', 'dividir')).toBe('reto-dividir');
  });

  it('sameProblem distingue la operación: 3 + 4 no es 3 × 4', () => {
    const add: Problem = { text: '3 + 4', answer: 7, operands: [3, 4], op: 'sumar' };
    const mul: Problem = { text: '3 × 4', answer: 12, operands: [3, 4], op: 'multiplicar' };
    expect(sameProblem(add, mul)).toBe(false);
    expect(sameProblem(add, { ...add })).toBe(true);
  });
});

describe('mezcla', () => {
  for (const id of DIFFICULTY_IDS) {
    it(`${id}: salen las cuatro operaciones, cada una con las cifras del nivel`, () => {
      const cfg = DIFFICULTIES[id];
      const rng = seededRng(17);
      const seen = new Set<ArithOp>();
      let previous: Problem | undefined;
      for (let i = 0; i < 1000; i++) {
        const p = generateProblemFor('mezcla', cfg, previous, rng);
        seen.add(p.op);
        const [a, b] = p.operands as [number, number];
        if (p.op === 'sumar') expect(cfg.addendDigits).toContain(digitsOf(a));
        if (p.op === 'restar') expect(cfg.minuendDigits).toContain(digitsOf(a));
        if (p.op === 'multiplicar') expect(cfg.multiplierDigits).toContain(digitsOf(b));
        if (p.op === 'dividir') expect(a % b).toBe(0);
        expect(sameProblem(previous, p)).toBe(false);
        previous = p;
      }
      expect([...seen].sort()).toEqual(['dividir', 'multiplicar', 'restar', 'sumar']);
    });
  }

  it('el tiempo depende de la operación del turno: la división tiene el doble', () => {
    const cfg = DIFFICULTIES.normal;
    const s = new BattleState(cfg, 'mezcla', seededRng(3));
    const base = timeLimitForWave(1, cfg);
    for (let i = 0; i < 30; i++) {
      expect(s.timeLimit).toBe(s.problem.op === 'dividir' ? base * 2 : base);
      s.tick(s.timeLimit);
      if (s.over) break;
    }
  });
});

describe('cifras del reto memoria', () => {
  for (const id of DIFFICULTY_IDS) {
    it(`${id}: iguales en los tres niveles, máximo 2 cifras`, () => {
      const cfg = DIFFICULTIES[id];
      const rng = seededRng(29);
      for (let i = 0; i < 1500; i++) {
        const sum = generateProblemFor('reto-sumar', cfg, undefined, rng);
        expect(sum.operands.every((v) => digitsOf(v) <= 2)).toBe(true);

        const sub = generateProblemFor('reto-restar', cfg, undefined, rng);
        const [m, s] = sub.operands as [number, number];
        expect(digitsOf(m)).toBeLessThanOrEqual(2);
        expect(digitsOf(s)).toBeLessThanOrEqual(digitsOf(m));
        expect(sub.answer).toBeGreaterThanOrEqual(1);

        const mul = generateProblemFor('reto-multiplicar', cfg, undefined, rng);
        expect(digitsOf(mul.operands[0]!)).toBeLessThanOrEqual(2);
        expect(digitsOf(mul.operands[1]!)).toBe(1);

        const div = generateProblemFor('reto-dividir', cfg, undefined, rng);
        const [dividend, divisor] = div.operands as [number, number];
        expect(digitsOf(dividend)).toBeLessThanOrEqual(2);
        expect(digitsOf(divisor)).toBe(1);
        expect(dividend % divisor).toBe(0);
        expect(div.op).toBe('dividir');
      }
    });
  }

  it('la resta con minuendo y sustraendo de las mismas cifras también da ≥ 1', () => {
    const cfg = { ...DIFFICULTIES.facil, minuendDigits: [2], subtrahendDigits: [2] };
    const rng = seededRng(6);
    for (let i = 0; i < 500; i++) {
      const p = generateProblemFor('restar', cfg, undefined, rng);
      expect(digitsOf(p.operands[1]!)).toBe(2);
      expect(p.answer).toBeGreaterThanOrEqual(1);
    }
  });
});
