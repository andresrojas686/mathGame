import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY_IDS, INITIAL_TIME } from '../config/difficulties';
import { BattleState } from './BattleState';
import { seededRng } from './testRng';

const newState = (id: keyof typeof DIFFICULTIES = 'facil', seed = 1) => new BattleState(DIFFICULTIES[id], seededRng(seed));

describe('BattleState', () => {
  it('arranca con los corazones del nivel, 0 aciertos y 7 segundos', () => {
    for (const id of DIFFICULTY_IDS) {
      const s = newState(id);
      expect(s.hearts).toBe(DIFFICULTIES[id].hearts);
      expect(s.correct).toBe(0);
      expect(s.timeLimit).toBe(INITIAL_TIME);
      expect(s.timeLeft).toBe(INITIAL_TIME);
      expect(s.over).toBe(false);
    }
  });

  it('acierto: suma 1, cambia la operación y reinicia el temporizador', () => {
    const s = newState();
    const before = s.problem;
    s.tick(3);
    expect(s.submit(before.answer)).toBe('correct');
    expect(s.correct).toBe(1);
    expect(s.problem).not.toBe(before);
    expect(s.problem.text).not.toBe(before.text);
    expect(s.timeLeft).toBe(s.timeLimit);
    expect(s.hearts).toBe(5);
  });

  it('fallo: no cambia la operación, no reinicia el temporizador y no cuesta corazones', () => {
    const s = newState();
    const before = s.problem;
    s.tick(2.5);
    const timeLeft = s.timeLeft;
    expect(s.submit(before.answer + 1)).toBe('miss');
    expect(s.submit(0)).toBe('miss');
    expect(s.problem).toBe(before);
    expect(s.timeLeft).toBe(timeLeft);
    expect(s.hearts).toBe(5);
    expect(s.correct).toBe(0);
  });

  it('fallo y luego acierto en la misma operación cuenta el acierto', () => {
    const s = newState();
    const before = s.problem;
    expect(s.submit(before.answer - 1)).toBe('miss');
    expect(s.submit(before.answer)).toBe('correct');
    expect(s.correct).toBe(1);
  });

  it('registra el historial con respuesta dada y tiempo usado', () => {
    const s = newState();
    const p = s.problem;
    s.tick(1.5);
    s.submit(1);
    s.tick(1);
    s.submit(p.answer);
    expect(s.history).toHaveLength(2);
    expect(s.history[0]).toMatchObject({ problem: p, given: 1, correct: false, timeUsed: 1.5 });
    expect(s.history[1]).toMatchObject({ problem: p, given: p.answer, correct: true, timeUsed: 2.5 });
  });

  it('tick sin llegar a cero devuelve running y descuenta el tiempo', () => {
    const s = newState();
    expect(s.tick(1)).toEqual({ type: 'running' });
    expect(s.timeLeft).toBeCloseTo(6);
  });

  it('timeout: resta un corazón, cambia la operación, reinicia el temporizador y devuelve la perdida', () => {
    const s = newState('normal');
    const lost = s.problem;
    const r = s.tick(INITIAL_TIME + 0.1);
    expect(r).toEqual({ type: 'hit', lost });
    expect(s.hearts).toBe(2);
    expect(s.problem).not.toBe(lost);
    expect(s.timeLeft).toBe(s.timeLimit);
    expect(s.history.at(-1)).toMatchObject({ problem: lost, given: null, correct: false });
  });

  it('el timeout se acumula entre ticks pequeños', () => {
    const s = newState();
    for (let i = 0; i < 69; i++) expect(s.tick(0.1).type).toBe('running');
    expect(s.tick(0.2).type).toBe('hit');
  });

  for (const id of DIFFICULTY_IDS) {
    it(`${id}: termina exactamente al perder ${DIFFICULTIES[id].hearts} corazones`, () => {
      const s = newState(id);
      const hearts = DIFFICULTIES[id].hearts;
      for (let i = 1; i < hearts; i++) {
        expect(s.tick(INITIAL_TIME).type).toBe('hit');
        expect(s.over).toBe(false);
      }
      const last = s.tick(INITIAL_TIME);
      expect(last.type).toBe('gameover');
      expect(s.hearts).toBe(0);
      expect(s.over).toBe(true);
    });
  }

  it('tras el fin de partida ignora entradas y ticks', () => {
    const s = newState('dificil');
    s.tick(INITIAL_TIME);
    expect(s.over).toBe(true);
    const p = s.problem;
    expect(s.submit(p.answer)).toBe('ignored');
    expect(s.tick(10)).toEqual({ type: 'running' });
    expect(s.correct).toBe(0);
    expect(s.hearts).toBe(0);
  });

  it('nunca pierde corazones por fallar, por muchos fallos que haya', () => {
    const s = newState('dificil');
    for (let i = 0; i < 50; i++) s.submit(-1);
    expect(s.hearts).toBe(1);
    expect(s.over).toBe(false);
  });
});
