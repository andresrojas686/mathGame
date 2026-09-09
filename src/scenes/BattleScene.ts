import Phaser from 'phaser';
import { DIFFICULTIES, isDifficultyId } from '../config/difficulties';
import { BattleState } from '../systems/BattleState';
import type { DifficultyId, Problem } from '../types';

const W = 1280;
const H = 720;

/** Colores provisionales de Fase 1. Los temas reales entran en Fase 4. */
const COLORS = {
  bg: 0x1e1e2e,
  text: '#f2e9d8',
  muted: '#8a8a9a',
  heartOn: 0xe8c87a,
  heartOff: 0x3a3a4a,
  timer: 0x6b8f5e,
  timerLow: 0xff5470,
  timerTrack: 0x2c2c3c,
  field: 0x2c2c3c,
  fieldBorder: 0x8a8a9a,
  hero: 0x4a90d9,
  monster: 0xc4643c,
  miss: '#e8c87a',
};

const NUMBER_FONT = 'Consolas, "Courier New", monospace';
const UI_FONT = '"Segoe UI", Arial, sans-serif';

/** Máximo de cifras de un resultado: 99999 × 999 = 99 899 001 → 8 cifras. Una de margen. */
const MAX_ANSWER_DIGITS = 9;
const REVEAL_MS = 500;
const MAX_TICK_MS = 100;

export class BattleScene extends Phaser.Scene {
  private state!: BattleState;
  private difficulty!: DifficultyId;
  private reducedMotion = false;

  private input$ = '';
  private paused = false;
  private revealMsLeft = 0;

  private hearts: Phaser.GameObjects.Rectangle[] = [];
  private correctText!: Phaser.GameObjects.Text;
  private problemText!: Phaser.GameObjects.Text;
  private timerFill!: Phaser.GameObjects.Rectangle;
  private timerWidth = 600;
  private answerBox!: Phaser.GameObjects.Rectangle;
  private answerText!: Phaser.GameObjects.Text;
  private answerGroup!: Phaser.GameObjects.Container;
  private missLabel!: Phaser.GameObjects.Text;
  private pauseLabel!: Phaser.GameObjects.Text;
  private monster!: Phaser.GameObjects.Rectangle;
  private hero!: Phaser.GameObjects.Rectangle;
  private overlay?: Phaser.GameObjects.Container;

  constructor() {
    super('Battle');
  }

  init(): void {
    const param = new URLSearchParams(window.location.search).get('level');
    this.difficulty = isDifficultyId(param) ? param : 'facil';
    this.state = new BattleState(DIFFICULTIES[this.difficulty]);
    this.input$ = '';
    this.paused = false;
    this.revealMsLeft = 0;
    this.overlay = undefined;
    this.hearts = [];
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.buildHud();
    this.buildStage();
    this.buildProblem();
    this.buildAnswer();
    this.bindKeyboard();
    this.bindFocus();
    this.renderAll();
  }

  override update(_time: number, delta: number): void {
    if (this.state.over || this.paused) return;

    if (this.revealMsLeft > 0) {
      this.revealMsLeft -= delta;
      if (this.revealMsLeft <= 0) this.renderProblem();
      return;
    }

    const dt = Math.min(delta, MAX_TICK_MS) / 1000;
    const result = this.state.tick(dt);
    this.renderTimer(_time);

    if (result.type === 'hit') this.onMonsterAttack(result.lost);
    else if (result.type === 'gameover') this.onGameOver(result.lost);
  }

  // ---------- construcción ----------

  private buildHud(): void {
    const cfg = DIFFICULTIES[this.difficulty];
    for (let i = 0; i < cfg.hearts; i++) {
      this.hearts.push(this.add.rectangle(56 + i * 48, 48, 36, 36, COLORS.heartOn));
    }
    this.correctText = this.add
      .text(W - 40, 48, '', { fontFamily: UI_FONT, fontSize: '32px', color: COLORS.text })
      .setOrigin(1, 0.5);
    this.add
      .text(W / 2, 48, `nivel: ${this.difficulty}`, { fontFamily: UI_FONT, fontSize: '20px', color: COLORS.muted })
      .setOrigin(0.5);
    this.pauseLabel = this.add
      .text(W / 2, H / 2, 'PAUSA', { fontFamily: UI_FONT, fontSize: '64px', color: COLORS.text })
      .setOrigin(0.5)
      .setDepth(50)
      .setVisible(false);
  }

  private buildStage(): void {
    this.hero = this.add.rectangle(200, 330, 120, 180, COLORS.hero);
    this.monster = this.add.rectangle(1080, 330, 160, 200, COLORS.monster);
    this.add.text(200, 440, 'héroe', { fontFamily: UI_FONT, fontSize: '18px', color: COLORS.muted }).setOrigin(0.5);
    this.add.text(1080, 450, 'monstruo', { fontFamily: UI_FONT, fontSize: '18px', color: COLORS.muted }).setOrigin(0.5);
    if (!this.reducedMotion) {
      this.tweens.add({ targets: [this.hero, this.monster], y: '+=8', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
  }

  private buildProblem(): void {
    this.problemText = this.add
      .text(W / 2, 290, '', { fontFamily: NUMBER_FONT, fontSize: '96px', color: COLORS.text })
      .setOrigin(0.5);

    const y = 370;
    this.add.rectangle(W / 2, y, this.timerWidth, 24, COLORS.timerTrack);
    this.timerFill = this.add.rectangle(W / 2 - this.timerWidth / 2, y, this.timerWidth, 24, COLORS.timer).setOrigin(0, 0.5);
  }

  private buildAnswer(): void {
    this.answerBox = this.add.rectangle(0, 0, 420, 84, COLORS.field).setStrokeStyle(3, COLORS.fieldBorder);
    this.answerText = this.add
      .text(0, 0, '', { fontFamily: NUMBER_FONT, fontSize: '56px', color: COLORS.text })
      .setOrigin(0.5);
    this.answerGroup = this.add.container(W / 2, 500, [this.answerBox, this.answerText]);

    this.missLabel = this.add
      .text(W / 2, 440, 'MISS', { fontFamily: UI_FONT, fontSize: '40px', fontStyle: 'bold', color: COLORS.miss })
      .setOrigin(0.5)
      .setAlpha(0);

    this.add
      .text(W / 2, 580, 'dígitos · Backspace borra · Enter confirma', {
        fontFamily: UI_FONT,
        fontSize: '18px',
        color: COLORS.muted,
      })
      .setOrigin(0.5);
  }

  /**
   * Se escucha el evento nativo y no el KeyboardPlugin de Phaser: este reemite su cola
   * cuando varias teclas llegan dentro del mismo frame y duplica los dígitos.
   */
  private bindKeyboard(): void {
    const handler = (event: KeyboardEvent) => this.onKey(event);
    window.addEventListener('keydown', handler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', handler));
  }

  private bindFocus(): void {
    const ev = this.game.events;
    const pause = () => this.setPaused(true);
    const resume = () => this.setPaused(false);
    ev.on(Phaser.Core.Events.BLUR, pause);
    ev.on(Phaser.Core.Events.HIDDEN, pause);
    ev.on(Phaser.Core.Events.FOCUS, resume);
    ev.on(Phaser.Core.Events.VISIBLE, resume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      ev.off(Phaser.Core.Events.BLUR, pause);
      ev.off(Phaser.Core.Events.HIDDEN, pause);
      ev.off(Phaser.Core.Events.FOCUS, resume);
      ev.off(Phaser.Core.Events.VISIBLE, resume);
    });
  }

  // ---------- entrada ----------

  private onKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const isDigit = event.key.length === 1 && event.key >= '0' && event.key <= '9';
    if (!isDigit && event.key !== 'Backspace' && event.key !== 'Enter') return;
    event.preventDefault();

    if (this.state.over) {
      if (event.key === 'Enter' && !event.repeat) this.scene.restart();
      return;
    }
    if (this.paused || this.revealMsLeft > 0) return;

    if (isDigit) {
      if (this.input$.length < MAX_ANSWER_DIGITS) {
        this.input$ += event.key;
        this.renderAnswer();
      }
      return;
    }
    if (event.key === 'Backspace') {
      this.input$ = this.input$.slice(0, -1);
      this.renderAnswer();
      return;
    }
    if (!event.repeat) this.confirm();
  }

  private confirm(): void {
    if (this.input$ === '') return;
    const answer = Number(this.input$);
    const result = this.state.submit(answer);
    this.input$ = '';
    this.renderAnswer();

    if (result === 'correct') this.onCorrect();
    else if (result === 'miss') this.onMiss();
  }

  // ---------- eventos del bucle ----------

  private onCorrect(): void {
    this.renderHud();
    this.renderProblem();
    if (this.reducedMotion) return;
    this.tweens.add({ targets: this.hero, x: 260, duration: 120, yoyo: true, ease: 'Quad.out' });
    this.tweens.add({ targets: this.monster, x: 1110, duration: 120, yoyo: true, delay: 100, ease: 'Quad.out' });
    this.flash(this.monster);
  }

  private onMiss(): void {
    // Sin sonido. El aviso es visual: MISS sube 30 px y se desvanece en 700 ms.
    this.tweens.killTweensOf(this.missLabel);
    this.tweens.killTweensOf(this.answerGroup);
    this.answerGroup.x = W / 2;
    this.missLabel.setY(440).setAlpha(1);

    if (this.reducedMotion) {
      this.tweens.add({ targets: this.missLabel, alpha: 0, duration: 300, delay: 400 });
      return;
    }
    this.tweens.add({ targets: this.missLabel, y: 410, duration: 700, ease: 'Quad.out' });
    this.tweens.add({ targets: this.missLabel, alpha: 0, duration: 300, delay: 400 });
    this.tweens.add({
      targets: this.answerGroup,
      x: { from: W / 2 - 10, to: W / 2 + 10 },
      duration: 50,
      yoyo: true,
      repeat: 3,
      onComplete: () => (this.answerGroup.x = W / 2),
    });
  }

  private onMonsterAttack(lost: Problem): void {
    this.input$ = '';
    this.renderAnswer();
    this.renderHud();
    this.showReveal(lost);
    if (!this.reducedMotion) {
      this.cameras.main.shake(250, 0.012);
      this.tweens.add({ targets: this.monster, x: 900, duration: 140, yoyo: true, ease: 'Quad.out' });
      this.flash(this.hero);
    }
  }

  private onGameOver(lost: Problem): void {
    this.renderHud();
    this.showReveal(lost);
    if (!this.reducedMotion) this.cameras.main.shake(400, 0.02);

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7);
    const title = this.add
      .text(W / 2, H / 2 - 80, 'FIN DE LA PARTIDA', { fontFamily: UI_FONT, fontSize: '64px', color: COLORS.text })
      .setOrigin(0.5);
    const score = this.add
      .text(W / 2, H / 2 + 10, `Aciertos: ${this.state.correct}`, { fontFamily: NUMBER_FONT, fontSize: '48px', color: COLORS.text })
      .setOrigin(0.5);
    const hint = this.add
      .text(W / 2, H / 2 + 90, 'Enter para jugar otra vez', { fontFamily: UI_FONT, fontSize: '24px', color: COLORS.muted })
      .setOrigin(0.5);
    this.overlay = this.add.container(0, 0, [dim, title, score, hint]).setDepth(100);
  }

  private setPaused(value: boolean): void {
    if (this.state.over) return;
    this.paused = value;
    this.pauseLabel.setVisible(value);
  }

  // ---------- render ----------

  private renderAll(): void {
    this.renderHud();
    this.renderProblem();
    this.renderAnswer();
    this.renderTimer(0);
  }

  private renderHud(): void {
    this.hearts.forEach((h, i) => h.setFillStyle(i < this.state.hearts ? COLORS.heartOn : COLORS.heartOff));
    this.correctText.setText(`Aciertos: ${this.state.correct}`);
  }

  private renderProblem(): void {
    this.problemText.setText(this.state.problem.text).setColor(COLORS.text);
    this.renderTimer(0);
  }

  /** Muestra medio segundo el resultado de la operación perdida antes de la siguiente. */
  private showReveal(lost: Problem): void {
    this.problemText.setText(`${lost.text} = ${lost.answer}`).setColor(COLORS.miss);
    this.revealMsLeft = REVEAL_MS;
    this.timerFill.width = 0;
  }

  private renderAnswer(): void {
    this.answerText.setText(this.input$);
  }

  private renderTimer(time: number): void {
    const ratio = this.state.timeLimit > 0 ? this.state.timeLeft / this.state.timeLimit : 0;
    this.timerFill.width = this.timerWidth * ratio;
    const low = this.state.timeLeft < 2;
    this.timerFill.setFillStyle(low ? COLORS.timerLow : COLORS.timer);
    this.timerFill.setAlpha(low && !this.reducedMotion ? 0.65 + 0.35 * Math.sin(time / 70) : 1);
  }

  private flash(target: Phaser.GameObjects.Rectangle): void {
    const original = target.fillColor;
    target.setFillStyle(0xffffff);
    this.time.delayedCall(90, () => target.setFillStyle(original));
  }
}
