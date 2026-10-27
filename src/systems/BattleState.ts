import type { DifficultyConfig, FailureSummary, HistoryEntry, Operation, Problem, Rng } from '../types';
import { monsterHpForWave, timeLimitForWave } from '../config/difficulties';
import { OPERATIONS_BY_ID } from '../config/operations';
import { RETO_BACK, RETO_MEMORIZE_TIME, RETO_TIME } from '../config/reto';
import { generateProblemFor } from './ProblemGenerator';

export type SubmitResult = 'correct' | 'defeated' | 'miss' | 'ignored';

export type TickResult =
  | { type: 'running' }
  /** Reto memoria: calentamiento en curso, sin reloj de respuesta. */
  | { type: 'memorize' }
  /** Reto memoria: apareció una operación nueva del calentamiento o la primera a responder. */
  | { type: 'shown' }
  /** `restart`: en el reto, la cadena vuelve a empezar con un calentamiento nuevo. */
  | { type: 'hit'; lost: Problem; restart: boolean }
  | { type: 'gameover'; lost: Problem };

export type BattlePhase = 'memorize' | 'answer';

/**
 * Máquina de estado del bucle de combate (plan.md §3). No importa nada de Phaser.
 *
 *  - Respuesta correcta  → +1 acierto, el monstruo pierde 1 de vida, nueva operación, temporizador se reinicia.
 *  - Monstruo a 0        → oleada siguiente: monstruo más resistente y menos tiempo (hasta el piso del nivel).
 *  - Respuesta incorrecta → nada cambia salvo el historial; se puede reintentar.
 *  - Se acaba el tiempo   → −1 corazón, nueva operación, temporizador se reinicia.
 *  - Corazones = 0        → fin de partida. Es la única salida del bucle.
 *
 * Reto memoria (plan.md §4): se responde el resultado de la operación vista `back` pasos antes.
 *  - Calentamiento: `back` operaciones de RETO_MEMORIZE_TIME s cada una, sin reloj ni respuestas.
 *  - Después cada acierto muestra una operación nueva y pide la siguiente de la cadena.
 *  - Se acaba el tiempo → −1 corazón y la cadena empieza de nuevo con otro calentamiento.
 *  - El tiempo para responder es siempre RETO_TIME.
 */
export class BattleState {
  readonly cfg: DifficultyConfig;
  readonly operation: Operation;
  readonly history: HistoryEntry[] = [];
  /** Reto memoria: cuántas operaciones hacia atrás se responden; 0 en los demás modos. */
  readonly back: number;

  hearts: number;
  correct = 0;
  /** Oleada actual, 1-based. */
  wave = 1;
  /** Monstruos derrotados. */
  wavesCleared = 0;
  monsterHp: number;
  monsterMaxHp: number;
  /** Operación que se ve en pantalla. */
  problem: Problem;
  timeLimit: number;
  timeLeft: number;
  over = false;
  /** Fuera del reto siempre es 'answer'. */
  phase: BattlePhase = 'answer';
  /** Reto memoria: segundos que le quedan en pantalla a la operación del calentamiento. */
  memorizeLeft = 0;

  private readonly rng: Rng;
  /** Reto memoria: operaciones vistas que aún no se han respondido, la más antigua primero. */
  private shown: Problem[] = [];

  constructor(cfg: DifficultyConfig, operation: Operation = 'multiplicar', rng: Rng = Math.random) {
    this.cfg = cfg;
    this.operation = operation;
    this.rng = rng;
    this.back = OPERATIONS_BY_ID[operation].kind === 'reto' ? RETO_BACK[cfg.id] : 0;
    this.hearts = cfg.hearts;
    this.monsterMaxHp = monsterHpForWave(this.wave);
    this.monsterHp = this.monsterMaxHp;
    this.problem = generateProblemFor(operation, cfg, undefined, rng);
    this.timeLimit = this.nextTimeLimit();
    this.timeLeft = this.timeLimit;
    if (this.isReto) this.startChain(this.problem);
  }

  get isReto(): boolean {
    return this.back > 0;
  }

  /** Operación cuyo resultado se pide: la de pantalla, o en el reto la de `back` pasos atrás. */
  get target(): Problem {
    return this.isReto ? this.shown[0]! : this.problem;
  }

  /** Reto memoria: posición (1-based) de la operación actual dentro del calentamiento. */
  get memorizeStep(): number {
    return this.shown.length;
  }

  /** Segundos usados en la operación actual. */
  get timeUsed(): number {
    return this.timeLimit - this.timeLeft;
  }

  nextTimeLimit(): number {
    if (this.isReto) return RETO_TIME;
    // En división el tiempo es el doble, incluido el piso (plan.md §4). En la mezcla
    // manda la operación que salió en este turno.
    return timeLimitForWave(this.wave, this.cfg) * OPERATIONS_BY_ID[this.problem.op].timeFactor;
  }

  submit(answer: number): SubmitResult {
    if (this.over || this.phase === 'memorize') return 'ignored';
    const target = this.target;
    const isCorrect = answer === target.answer;
    this.history.push({ problem: target, given: answer, correct: isCorrect, timeUsed: this.timeUsed });
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
    if (this.isReto) this.shown.shift();
    this.advance();
    return defeated ? 'defeated' : 'correct';
  }

  /** Descuenta `dtSeconds` del temporizador y resuelve el ataque del monstruo si llega a cero. */
  tick(dtSeconds: number): TickResult {
    if (this.over) return { type: 'running' };
    if (this.phase === 'memorize') return this.tickMemorize(dtSeconds);
    this.timeLeft = Math.max(0, this.timeLeft - dtSeconds);
    if (this.timeLeft > 0) return { type: 'running' };

    const lost = this.target;
    this.history.push({ problem: lost, given: null, correct: false, timeUsed: this.timeLimit });
    this.hearts -= 1;

    if (this.hearts <= 0) {
      this.hearts = 0;
      this.over = true;
      return { type: 'gameover', lost };
    }

    if (this.isReto) {
      // Perdido el hilo, no se puede saber qué tocaba: la cadena empieza de nuevo.
      this.shown = [];
      this.advance();
      this.startChain(this.problem);
      return { type: 'hit', lost, restart: true };
    }
    this.advance();
    return { type: 'hit', lost, restart: false };
  }

  private tickMemorize(dtSeconds: number): TickResult {
    this.memorizeLeft = Math.max(0, this.memorizeLeft - dtSeconds);
    if (this.memorizeLeft > 0) return { type: 'memorize' };
    this.advance();
    if (this.shown.length > this.back) this.phase = 'answer';
    else this.memorizeLeft = RETO_MEMORIZE_TIME;
    return { type: 'shown' };
  }

  /** Reto memoria: arranca un calentamiento con `first` como primera operación. */
  private startChain(first: Problem): void {
    this.shown = [first];
    this.phase = 'memorize';
    this.memorizeLeft = RETO_MEMORIZE_TIME;
  }

  private advance(): void {
    this.problem = generateProblemFor(this.operation, this.cfg, this.problem, this.rng);
    if (this.isReto) this.shown.push(this.problem);
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
