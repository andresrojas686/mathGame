import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY_IDS } from '../config/difficulties';
import { RETO_BACK, RETO_MEMORIZE_TIME, RETO_TIME } from '../config/reto';
import { BattleState } from './BattleState';
import { seededRng } from './testRng';
import type { DifficultyId, Problem } from '../types';

const newReto = (id: DifficultyId, seed = 1) => new BattleState(DIFFICULTIES[id], 'reto-sumar', seededRng(seed));

/** Pasa el calentamiento completo y devuelve las operaciones que se vieron, en orden. */
function warmUp(s: BattleState): Problem[] {
  const seen = [s.problem];
  while (s.phase === 'memorize') {
    expect(s.tick(RETO_MEMORIZE_TIME).type).toBe('shown');
    seen.push(s.problem);
  }
  return seen;
}

describe('BattleState: reto memoria', () => {
  it('usa N = 1, 2 y 3 operaciones atrás según el nivel', () => {
    expect(DIFFICULTY_IDS.map((id) => newReto(id).back)).toEqual([1, 2, 3]);
    expect(RETO_BACK).toEqual({ facil: 1, normal: 2, dificil: 3 });
  });

  it('fuera del reto no hay calentamiento ni cadena', () => {
    const s = new BattleState(DIFFICULTIES.normal, 'sumar', seededRng(1));
    expect(s.isReto).toBe(false);
    expect(s.phase).toBe('answer');
    expect(s.target).toBe(s.problem);
  });

  for (const id of DIFFICULTY_IDS) {
    it(`${id}: calentamiento de N operaciones de ${RETO_MEMORIZE_TIME} s sin respuestas ni reloj`, () => {
      const s = newReto(id);
      const n = s.back;
      for (let step = 1; step <= n; step++) {
        expect(s.phase).toBe('memorize');
        expect(s.memorizeStep).toBe(step);
        expect(s.submit(s.problem.answer)).toBe('ignored');
        expect(s.tick(RETO_MEMORIZE_TIME - 1).type).toBe('memorize');
        expect(s.timeLeft).toBe(RETO_TIME);
        expect(s.tick(1).type).toBe('shown');
      }
      expect(s.phase).toBe('answer');
      expect(s.history).toHaveLength(0);
    });

    it(`${id}: se pide el resultado de la operación de N pasos atrás, en cadena`, () => {
      const s = newReto(id, 7);
      const seen = warmUp(s);
      for (let i = 0; i < 12; i++) {
        expect(s.target).toBe(seen[i]);
        expect(s.submit(s.target.answer)).not.toBe('miss');
        seen.push(s.problem);
      }
      expect(s.correct).toBe(12);
    });
  }

  it('responder la operación que está en pantalla es un fallo', () => {
    const s = newReto('normal', 3);
    warmUp(s);
    // Con N = 2 la de pantalla casi nunca coincide en resultado con la de dos pasos atrás.
    if (s.problem.answer !== s.target.answer) expect(s.submit(s.problem.answer)).toBe('miss');
  });

  it('al fallar se puede reintentar sin perder la cadena ni el reloj', () => {
    const s = newReto('facil', 4);
    warmUp(s);
    const target = s.target;
    s.tick(2);
    expect(s.submit(target.answer + 1)).toBe('miss');
    expect(s.target).toBe(target);
    expect(s.timeLeft).toBeCloseTo(RETO_TIME - 2);
    expect(s.submit(target.answer)).toBe('correct');
  });

  it('se acaba el tiempo: −1 corazón, la cadena se reinicia con otro calentamiento', () => {
    const s = newReto('normal', 5);
    warmUp(s);
    const target = s.target;
    const hearts = s.hearts;
    const result = s.tick(RETO_TIME);
    expect(result).toEqual({ type: 'hit', lost: target, restart: true });
    expect(s.hearts).toBe(hearts - 1);
    expect(s.phase).toBe('memorize');
    expect(s.memorizeStep).toBe(1);
    expect(s.history.at(-1)).toMatchObject({ problem: target, given: null });

    const seen = warmUp(s);
    expect(s.target).toBe(seen[0]);
  });

  it('el tiempo para responder es siempre 7 s, también en oleadas altas', () => {
    const s = newReto('dificil', 9);
    warmUp(s);
    for (let i = 0; i < 40; i++) {
      expect(s.timeLimit).toBe(RETO_TIME);
      s.submit(s.target.answer);
    }
    expect(s.wave).toBeGreaterThan(3);
    expect(s.timeLimit).toBe(RETO_TIME);
  });

  it('el historial guarda la operación que se pedía, no la de pantalla', () => {
    const s = newReto('facil', 2);
    warmUp(s);
    const target = s.target;
    s.submit(-1);
    expect(s.history[0]?.problem).toBe(target);
  });

  it('con la misma semilla la secuencia es la misma aunque cada jugador reinicie en otro momento', () => {
    const run = (timeoutAt: number): string[] => {
      const s = newReto('normal', 4242);
      const texts = [s.problem.text];
      for (let i = 0; texts.length < 20; i++) {
        const before = s.problem;
        if (s.phase === 'memorize') s.tick(RETO_MEMORIZE_TIME);
        else if (i === timeoutAt) s.tick(RETO_TIME);
        else s.submit(s.target.answer);
        if (s.problem !== before) texts.push(s.problem.text);
      }
      return texts;
    };
    expect(run(4)).toEqual(run(9));
  });
});
