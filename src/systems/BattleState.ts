import type { DifficultyConfig, HistoryEntry, Problem, Rng } from '../types';
import { timeLimitForWave } from '../config/difficulties';
import { generateProblem } from './ProblemGenerator';

export type SubmitResult = 'correct' | 'miss' | 'ignored';

export type TickResult =
  | { type: 'running' }
  | { type: 'hit'; lost: Problem }
  | { type: 'gameover'; lost: Problem };

/**
 * Máquina de estado del bucle de combate (plan.md §3). No importa nada de Phaser.
 *
 *  - Respuesta correcta  → +1 acierto, nueva operación, temporizador se reinicia.
 *  - Respuesta incorrecta → nada cambia salvo el historial; se puede reintentar.
 *  - Se acaba el tiempo   → −1 corazón, nueva operación, temporizador se reinicia.
 *  - Corazones = 0        → fin de partida. Es la única salida del bucle.
 */
export class BattleState {
  readonly cfg: DifficultyConfig;
  readonly history: HistoryEntry[] = [];

  hearts: number;
  correct = 0;
  /** Oleada actual, 1-based. En Fase 1 no avanza; Fase 2 le da vida al monstruo. */
  wave = 1;
  problem: Problem;
  timeLimit: number;
  timeLeft: number;
  over = false;

  private readonly rng: Rng;

  constructor(cfg: DifficultyConfig, rng: Rng = Math.random) {
    this.cfg = cfg;
    this.rng = rng;
    this.hearts = cfg.hearts;
    this.problem = generateProblem(cfg, undefined, rng);
    this.timeLimit = this.nextTimeLimit();
    this.timeLeft = this.timeLimit;
  }

  /** Segundos usados en la operación actual. */
  get timeUsed(): number {
    return this.timeLimit - this.timeLeft;
  }

  /** Punto único donde Fase 2 conecta la curva de oleadas. */
  nextTimeLimit(): number {
    return timeLimitForWave(this.wave, this.cfg);
  }

  submit(answer: number): SubmitResult {
    if (this.over) return 'ignored';
    const isCorrect = answer === this.problem.answer;
    this.history.push({ problem: this.problem, given: answer, correct: isCorrect, timeUsed: this.timeUsed });
    if (!isCorrect) return 'miss';

    this.correct += 1;
    this.advance();
    return 'correct';
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
