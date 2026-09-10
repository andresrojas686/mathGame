import type { DifficultyConfig, FailureSummary, HistoryEntry, Problem, Rng } from '../types';
import { monsterHpForWave, timeLimitForWave } from '../config/difficulties';
import { generateProblem } from './ProblemGenerator';

export type SubmitResult = 'correct' | 'defeated' | 'miss' | 'ignored';

export type TickResult =
  | { type: 'running' }
  | { type: 'hit'; lost: Problem }
  | { type: 'gameover'; lost: Problem };

/**
 * Máquina de estado del bucle de combate (plan.md §3). No importa nada de Phaser.
 *
 *  - Respuesta correcta  → +1 acierto, el monstruo pierde 1 de vida, nueva operación, temporizador se reinicia.
 *  - Monstruo a 0        → oleada siguiente: monstruo más resistente y menos tiempo (hasta el piso del nivel).
 *  - Respuesta incorrecta → nada cambia salvo el historial; se puede reintentar.
 *  - Se acaba el tiempo   → −1 corazón, nueva operación, temporizador se reinicia.
 *  - Corazones = 0        → fin de partida. Es la única salida del bucle.
 */
export class BattleState {
  readonly cfg: DifficultyConfig;
  readonly history: HistoryEntry[] = [];

  hearts: number;
  correct = 0;
  /** Oleada actual, 1-based. */
  wave = 1;
  /** Monstruos derrotados. */
  wavesCleared = 0;
  monsterHp: number;
  monsterMaxHp: number;
  problem: Problem;
  timeLimit: number;
  timeLeft: number;
  over = false;

  private readonly rng: Rng;

  constructor(cfg: DifficultyConfig, rng: Rng = Math.random) {
    this.cfg = cfg;
    this.rng = rng;
    this.hearts = cfg.hearts;
    this.monsterMaxHp = monsterHpForWave(this.wave);
    this.monsterHp = this.monsterMaxHp;
    this.problem = generateProblem(cfg, undefined, rng);
    this.timeLimit = this.nextTimeLimit();
    this.timeLeft = this.timeLimit;
  }

  /** Segundos usados en la operación actual. */
  get timeUsed(): number {
    return this.timeLimit - this.timeLeft;
  }

  nextTimeLimit(): number {
    return timeLimitForWave(this.wave, this.cfg);
  }

  submit(answer: number): SubmitResult {
    if (this.over) return 'ignored';
    const isCorrect = answer === this.problem.answer;
    this.history.push({ problem: this.problem, given: answer, correct: isCorrect, timeUsed: this.timeUsed });
    if (!isCorrect) return 'miss';

    this.correct += 1;
    this.monsterHp -= 1;
    const defeated = this.monsterHp <= 0;
    if (defeated) {
      this.wavesCleared += 1;
      this.wave += 1;
      this.monsterMaxHp = monsterHpForWave(this.wave);
      this.monsterHp = this.monsterMaxHp;
    }
    this.advance();
    return defeated ? 'defeated' : 'correct';
  }

  /** Descuenta `dtSeconds` del temporizador y resuelve el ataque del monstruo si llega a cero. */
  tick(dtSeconds: number): TickResult {
    if (this.over) return { type: 'running' };
    this.timeLeft = Math.max(0, this.timeLeft - dtSeconds);
    if (this.timeLeft > 0) return { type: 'running' };

    const lost = this.problem;
    this.history.push({ problem: lost, given: null, correct: false, timeUsed: this.timeLimit });
    this.hearts -= 1;

    if (this.hearts <= 0) {
      this.hearts = 0;
      this.over = true;
      return { type: 'gameover', lost };
    }

    this.advance();
    return { type: 'hit', lost };
  }

  private advance(): void {
    this.problem = generateProblem(this.cfg, this.problem, this.rng);
    this.timeLimit = this.nextTimeLimit();
    this.timeLeft = this.timeLimit;
  }
}

/**
 * Agrupa el historial por operación y devuelve solo las que tuvieron algún fallo
 * (respuesta incorrecta o tiempo agotado), ordenadas de más a menos problemática.
 */
export function summarizeFailures(history: readonly HistoryEntry[]): FailureSummary[] {
  const byText = new Map<string, FailureSummary>();
  for (const entry of history) {
    const key = entry.problem.text;
    let s = byText.get(key);
    if (!s) {
      s = { problem: entry.problem, misses: 0, timeouts: 0, solved: false };
      byText.set(key, s);
    }
    if (entry.correct) s.solved = true;
    else if (entry.given === null) s.timeouts += 1;
    else s.misses += 1;
  }
  return [...byText.values()]
    .filter((s) => s.misses + s.timeouts > 0)
    .sort((a, b) => b.timeouts - a.timeouts || b.misses - a.misses || a.problem.text.localeCompare(b.problem.text));
}
