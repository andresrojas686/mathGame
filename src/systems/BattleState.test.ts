import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, DIFFICULTY_IDS, monsterHpForWave, timeLimitForWave } from '../config/difficulties';
import { BattleState, summarizeFailures } from './BattleState';
import { seededRng } from './testRng';
import type { DifficultyId, HistoryEntry, Problem } from '../types';

const newState = (id: DifficultyId = 'facil', seed = 1) => new BattleState(DIFFICULTIES[id], seededRng(seed));
const timeout = (s: BattleState) => s.tick(s.timeLimit + 1);

describe('BattleState: arranque', () => {
  it('arranca con los corazones del nivel, 0 aciertos, oleada 1 y el tiempo de la oleada 1', () => {
    for (const id of DIFFICULTY_IDS) {
      const s = newState(id);
      const cfg = DIFFICULTIES[id];
      expect(s.hearts).toBe(cfg.hearts);
      expect(s.correct).toBe(0);
      expect(s.wave).toBe(1);
      expect(s.wavesCleared).toBe(0);
      expect(s.monsterMaxHp).toBe(monsterHpForWave(1));
      expect(s.monsterHp).toBe(s.monsterMaxHp);
      expect(s.timeLimit).toBe(timeLimitForWave(1, cfg));
      expect(s.timeLeft).toBe(s.timeLimit);
      expect(s.over).toBe(false);
    }
  });
});

describe('BattleState: respuestas', () => {
  it('acierto: suma 1, quita 1 de vida al monstruo, cambia la operación y reinicia el temporizador', () => {
    const s = newState();
    const before = s.problem;
    s.tick(3);
    expect(s.submit(before.answer)).toBe('correct');
    expect(s.correct).toBe(1);
    expect(s.monsterHp).toBe(s.monsterMaxHp - 1);
    expect(s.problem).not.toBe(before);
    expect(s.problem.text).not.toBe(before.text);
    expect(s.timeLeft).toBe(s.timeLimit);
    expect(s.hearts).toBe(DIFFICULTIES.facil.hearts);
  });

  it('fallo: no cambia la operación, no reinicia el temporizador y no cuesta corazones ni vida del monstruo', () => {
    const s = newState();
    const before = s.problem;
    s.tick(2.5);
    const timeLeft = s.timeLeft;
    expect(s.submit(before.answer + 1)).toBe('miss');
    expect(s.submit(0)).toBe('miss');
    expect(s.problem).toBe(before);
    expect(s.timeLeft).toBe(timeLeft);
    expect(s.hearts).toBe(DIFFICULTIES.facil.hearts);
    expect(s.monsterHp).toBe(s.monsterMaxHp);
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

  it('nunca pierde corazones por fallar, por muchos fallos que haya', () => {
    const s = newState('dificil');
    for (let i = 0; i < 50; i++) s.submit(-1);
    expect(s.hearts).toBe(DIFFICULTIES.dificil.hearts);
    expect(s.over).toBe(false);
  });
});

describe('BattleState: oleadas', () => {
  it('al agotar la vida del monstruo pasa a la oleada siguiente con más vida', () => {
    const s = newState('normal');
    const hp1 = monsterHpForWave(1);
    for (let i = 0; i < hp1 - 1; i++) expect(s.submit(s.problem.answer)).toBe('correct');
    expect(s.monsterHp).toBe(1);
    expect(s.submit(s.problem.answer)).toBe('defeated');
    expect(s.wave).toBe(2);
    expect(s.wavesCleared).toBe(1);
    expect(s.monsterMaxHp).toBe(monsterHpForWave(2));
    expect(s.monsterHp).toBe(s.monsterMaxHp);
    expect(s.correct).toBe(hp1);
    expect(s.timeLimit).toBe(timeLimitForWave(2, DIFFICULTIES.normal));
    expect(s.timeLeft).toBe(s.timeLimit);
  });

  it('la partida no tiene final: diez oleadas seguidas siguen en curso', () => {
    const s = newState('facil');
    let answered = 0;
    for (let wave = 1; wave <= 10; wave++) {
      const hp = monsterHpForWave(wave);
      for (let i = 0; i < hp; i++) {
        s.submit(s.problem.answer);
        answered += 1;
      }
      expect(s.wave).toBe(wave + 1);
      expect(s.timeLimit).toBe(timeLimitForWave(wave + 1, DIFFICULTIES.facil));
      expect(s.timeLimit).toBeGreaterThanOrEqual(DIFFICULTIES.facil.timeFloor);
    }
    expect(s.wavesCleared).toBe(10);
    expect(s.correct).toBe(answered);
    expect(s.over).toBe(false);
  });

  it('el timeout no cambia la oleada ni cura al monstruo', () => {
    const s = newState('facil');
    s.submit(s.problem.answer);
    const hp = s.monsterHp;
    timeout(s);
    expect(s.wave).toBe(1);
    expect(s.monsterHp).toBe(hp);
  });
});

describe('BattleState: tiempo', () => {
  it('tick sin llegar a cero devuelve running y descuenta el tiempo', () => {
    const s = newState();
    const limit = s.timeLimit;
    expect(s.tick(1)).toEqual({ type: 'running' });
    expect(s.timeLeft).toBeCloseTo(limit - 1);
  });

  it('timeout: resta un corazón, cambia la operación, reinicia el temporizador y devuelve la perdida', () => {
    const s = newState('normal');
    const lost = s.problem;
    const r = timeout(s);
    expect(r).toEqual({ type: 'hit', lost });
    expect(s.hearts).toBe(DIFFICULTIES.normal.hearts - 1);
    expect(s.problem).not.toBe(lost);
    expect(s.timeLeft).toBe(s.timeLimit);
    expect(s.history.at(-1)).toMatchObject({ problem: lost, given: null, correct: false });
  });

  it('el timeout se acumula entre ticks pequeños', () => {
    const s = newState();
    const steps = Math.round(s.timeLimit / 0.1);
    for (let i = 0; i < steps - 1; i++) expect(s.tick(0.1).type).toBe('running');
    expect(s.tick(0.2).type).toBe('hit');
  });

  for (const id of DIFFICULTY_IDS) {
    it(`${id}: termina exactamente al perder ${DIFFICULTIES[id].hearts} corazones`, () => {
      const s = newState(id);
      const hearts = DIFFICULTIES[id].hearts;
      for (let i = 1; i < hearts; i++) {
        expect(timeout(s).type).toBe('hit');
        expect(s.over).toBe(false);
      }
      expect(timeout(s).type).toBe('gameover');
      expect(s.hearts).toBe(0);
      expect(s.over).toBe(true);
    });
  }

  it('tras el fin de partida ignora entradas y ticks', () => {
    const s = newState('dificil');
    for (let i = 0; i < DIFFICULTIES.dificil.hearts; i++) timeout(s);
    expect(s.over).toBe(true);
    expect(s.submit(s.problem.answer)).toBe('ignored');
    expect(s.tick(10)).toEqual({ type: 'running' });
    expect(s.correct).toBe(0);
    expect(s.hearts).toBe(0);
  });
});

describe('timeLimitForWave', () => {
  const cfg = { ...DIFFICULTIES.facil, timeFloor: 5 };
  it('sigue la tabla del plan: 7.0, 6.5, 6.0 ... hasta el piso', () => {
    expect(timeLimitForWave(1, cfg)).toBe(7);
    expect(timeLimitForWave(2, cfg)).toBe(6.5);
    expect(timeLimitForWave(3, cfg)).toBe(6);
    expect(timeLimitForWave(5, cfg)).toBe(5);
    expect(timeLimitForWave(6, cfg)).toBe(5);
    expect(timeLimitForWave(50, cfg)).toBe(5);
  });
  it('si el piso supera el tiempo inicial, el tiempo queda fijo en el piso', () => {
    const high = { ...cfg, timeFloor: 15 };
    expect(timeLimitForWave(1, high)).toBe(15);
    expect(timeLimitForWave(9, high)).toBe(15);
  });
});

describe('summarizeFailures', () => {
  const p = (a: number, b: number): Problem => ({ text: `${a} × ${b}`, answer: a * b, operands: [a, b] });
  const entry = (problem: Problem, given: number | null, correct = false): HistoryEntry => ({ problem, given, correct, timeUsed: 1 });

  it('devuelve solo las operaciones con algún fallo, agrupadas', () => {
    const a = p(12, 3);
    const b = p(45, 6);
    const c = p(7, 8);
    const out = summarizeFailures([
      entry(a, 35),
      entry(a, 36, true),
      entry(b, null),
      entry(c, 56, true),
      entry(b, 270, true),
    ]);
    expect(out.map((f) => f.problem.text)).toEqual(['45 × 6', '12 × 3']);
    expect(out[0]).toMatchObject({ timeouts: 1, misses: 0, solved: true });
    expect(out[1]).toMatchObject({ timeouts: 0, misses: 1, solved: true });
  });

  it('ordena primero por tiempos agotados y luego por fallos', () => {
    const a = p(2, 2);
    const b = p(3, 3);
    const c = p(4, 4);
    const out = summarizeFailures([entry(a, 1), entry(a, 2), entry(a, 3), entry(b, null), entry(c, 1)]);
    expect(out.map((f) => f.problem.text)).toEqual(['3 × 3', '2 × 2', '4 × 4']);
    expect(out[1]?.solved).toBe(false);
  });

  it('con historial limpio devuelve lista vacía', () => {
    expect(summarizeFailures([entry(p(2, 3), 6, true)])).toEqual([]);
  });
});
