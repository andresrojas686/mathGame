import Phaser from 'phaser';
import { DIFFICULTIES, DIFFICULTY_LABELS, isDifficultyId } from '../config/difficulties';
import { DEFAULT_TRAINER_ID } from '../config/trainers';
import { BattleState } from '../systems/BattleState';
import { fetchPokemonInfo, randomPokemonId, type PokemonInfo } from '../systems/pokemon/PokeApi';
import type { BattleParams, DifficultyId, Operation, Problem, ResultParams } from '../types';
import { HeroView } from '../ui/HeroView';
import { bindWindowKeys, isDigitKey } from '../ui/keys';
import { MonsterView } from '../ui/MonsterView';
import { COLORS, H, NUMBER_FONT, prefersReducedMotion, UI_FONT, W } from '../ui/style';

/** Máximo de cifras de un resultado: 99999 × 999 = 99 899 001 → 8 cifras. Una de margen. */
const MAX_ANSWER_DIGITS = 9;
const REVEAL_MS = 500;
const MAX_TICK_MS = 100;
const GAME_OVER_DELAY_MS = 1400;

export class BattleScene extends Phaser.Scene {
  private state!: BattleState;
  private difficulty!: DifficultyId;
  private operation: Operation = 'multiplicar';
  private playerName = '';
  private trainerId = DEFAULT_TRAINER_ID;
  private reducedMotion = false;

  private input$ = '';
  private paused = false;
  private revealMsLeft = 0;

  /** Pokémon en pantalla y el siguiente, ya pedido para que el cambio de oleada sea inmediato. */
  private nextPokemon: Promise<PokemonInfo> | null = null;
  private defeatedNames: string[] = [];
  private usedIds = new Set<number>();

  private hearts: Phaser.GameObjects.Rectangle[] = [];
  private correctText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private problemText!: Phaser.GameObjects.Text;
  private timerFill!: Phaser.GameObjects.Rectangle;
  private timerWidth = 600;
  private answerText!: Phaser.GameObjects.Text;
  private answerGroup!: Phaser.GameObjects.Container;
  private missLabel!: Phaser.GameObjects.Text;
  private pauseLabel!: Phaser.GameObjects.Text;
  private hero!: HeroView;
  private monster!: MonsterView;

  constructor() {
    super('Battle');
  }

  init(data: Partial<BattleParams>): void {
    const param = new URLSearchParams(window.location.search).get('level');
    this.difficulty = data.level ?? (isDifficultyId(param) ? param : 'facil');
    this.operation = data.operation ?? 'multiplicar';
    this.playerName = data.name ?? 'Jugador';
    this.trainerId = data.trainer ?? DEFAULT_TRAINER_ID;
    this.state = new BattleState(DIFFICULTIES[this.difficulty]);
    this.input$ = '';
    this.paused = false;
    this.revealMsLeft = 0;
    this.hearts = [];
    this.nextPokemon = null;
    this.defeatedNames = [];
    this.usedIds = new Set();
    this.reducedMotion = prefersReducedMotion();
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.buildHud();
    this.buildStage();
    this.buildProblem();
    this.buildAnswer();
    bindWindowKeys(this, (e) => this.onKey(e));
    this.bindFocus();
    this.renderAll();
    void this.spawnFirstPokemon();
  }

  override update(time: number, delta: number): void {
    if (this.state.over || this.paused) return;

    if (this.revealMsLeft > 0) {
      this.revealMsLeft -= delta;
      if (this.revealMsLeft <= 0) this.renderProblem();
      return;
    }

    const dt = Math.min(delta, MAX_TICK_MS) / 1000;
    const result = this.state.tick(dt);
    this.renderTimer(time);

    if (result.type === 'hit') this.onMonsterAttack(result.lost);
    else if (result.type === 'gameover') this.onGameOver(result.lost);
  }

  // ---------- Pokémon ----------

  private requestPokemon(): Promise<PokemonInfo> {
    let id = randomPokemonId();
    // Evita repetir dentro de la misma partida mientras haya de sobra.
    for (let i = 0; i < 10 && this.usedIds.has(id); i++) id = randomPokemonId();
    this.usedIds.add(id);
    return fetchPokemonInfo(id);
  }

  private async spawnFirstPokemon(): Promise<void> {
    const first = await this.requestPokemon();
    if (!this.scene.isActive()) return;
    this.monster.show(first);
    this.prefetchNext();
  }

  private prefetchNext(): void {
    this.nextPokemon = this.requestPokemon().then((info) => {
      if (this.scene.isActive()) this.monster.preload(info);
      return info;
    });
  }

  // ---------- construcción ----------

  private buildHud(): void {
    const cfg = DIFFICULTIES[this.difficulty];
    const size = cfg.hearts > 6 ? 26 : 36;
    const step = size + 10;
    for (let i = 0; i < cfg.hearts; i++) {
      this.hearts.push(this.add.rectangle(40 + size / 2 + i * step, 48, size, size, COLORS.heartOn));
    }
    this.correctText = this.add.text(W - 40, 40, '', { fontFamily: UI_FONT, fontSize: '32px', color: COLORS.text }).setOrigin(1, 0.5);
    this.waveText = this.add.text(W - 40, 74, '', { fontFamily: UI_FONT, fontSize: '20px', color: COLORS.muted }).setOrigin(1, 0.5);
    this.add
      .text(W / 2, 48, `${this.playerName} · ${DIFFICULTY_LABELS[this.difficulty].title}`, { fontFamily: UI_FONT, fontSize: '20px', color: COLORS.muted })
      .setOrigin(0.5);
    this.pauseLabel = this.add
      .text(W / 2, H / 2, 'PAUSA', { fontFamily: UI_FONT, fontSize: '64px', color: COLORS.text })
      .setOrigin(0.5)
      .setDepth(50)
      .setVisible(false);
  }

  private buildStage(): void {
    this.hero = new HeroView(this, 200, 330, this.trainerId, this.reducedMotion);
    this.monster = new MonsterView(this, 1080, 340, this.reducedMotion);
    if (!this.reducedMotion) {
      this.tweens.add({ targets: this.hero, y: '+=8', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
  }

  private buildProblem(): void {
    this.problemText = this.add.text(W / 2, 290, '', { fontFamily: NUMBER_FONT, fontSize: '96px', color: COLORS.text }).setOrigin(0.5);
    const y = 370;
    this.add.rectangle(W / 2, y, this.timerWidth, 24, COLORS.timerTrack);
    this.timerFill = this.add.rectangle(W / 2 - this.timerWidth / 2, y, this.timerWidth, 24, COLORS.timer).setOrigin(0, 0.5);
  }

  private buildAnswer(): void {
    const box = this.add.rectangle(0, 0, 420, 84, COLORS.field).setStrokeStyle(3, COLORS.fieldBorder);
    this.answerText = this.add.text(0, 0, '', { fontFamily: NUMBER_FONT, fontSize: '56px', color: COLORS.text }).setOrigin(0.5);
    this.answerGroup = this.add.container(W / 2, 500, [box, this.answerText]);

    this.missLabel = this.add
      .text(W / 2, 440, 'MISS', { fontFamily: UI_FONT, fontSize: '40px', fontStyle: 'bold', color: COLORS.miss })
      .setOrigin(0.5)
      .setAlpha(0);

    this.add
      .text(W / 2, 580, 'dígitos · Backspace borra · Enter confirma', { fontFamily: UI_FONT, fontSize: '18px', color: COLORS.muted })
      .setOrigin(0.5);
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
    const digit = isDigitKey(event);
    if (!digit && event.key !== 'Backspace' && event.key !== 'Enter') return;
    event.preventDefault();
    if (this.state.over || this.paused || this.revealMsLeft > 0) return;

    if (digit) {
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
    else if (result === 'defeated') this.onMonsterDefeated();
    else if (result === 'miss') this.onMiss();
  }

  // ---------- eventos del bucle ----------

  private onCorrect(): void {
    this.renderHud();
    this.renderProblem();
    this.hero.attack();
    this.monster.hit();
  }

  /** El Pokémon cae y entra el siguiente, más resistente. La siguiente operación ya está en pantalla. */
  private onMonsterDefeated(): void {
    this.defeatedNames.push(this.monster.pokemonName);
    this.renderHud();
    this.renderProblem();
    this.hero.attack();

    const pending = this.nextPokemon ?? this.requestPokemon();
    this.nextPokemon = null;
    void pending.then((next) => {
      if (!this.scene.isActive()) return;
      this.monster.swapTo(next, () => this.renderHud());
      this.prefetchNext();
    });
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
    if (!this.reducedMotion) this.cameras.main.shake(250, 0.012);
    this.monster.lunge();
    this.hero.hit();
  }

  private onGameOver(lost: Problem): void {
    this.renderHud();
    this.showReveal(lost);
    if (!this.reducedMotion) this.cameras.main.shake(400, 0.02);
    this.tweens.add({ targets: this.cameras.main, alpha: 0, duration: 600, delay: GAME_OVER_DELAY_MS - 600 });
    this.time.delayedCall(GAME_OVER_DELAY_MS, () => {
      const params: ResultParams = {
        level: this.difficulty,
        operation: this.operation,
        name: this.playerName,
        trainer: this.trainerId,
        correct: this.state.correct,
        waves: this.state.wavesCleared,
        history: this.state.history,
        defeated: this.defeatedNames,
      };
      this.cameras.main.setAlpha(1);
      this.scene.start('Result', params);
    });
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
    const s = this.state;
    this.hearts.forEach((h, i) => h.setFillStyle(i < s.hearts ? COLORS.heartOn : COLORS.heartOff));
    this.correctText.setText(`Aciertos: ${s.correct}`);
    this.waveText.setText(`Oleada ${s.wave} · ${s.timeLimit} s`);
    this.monster.setHp(s.monsterHp, s.monsterMaxHp);
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
}
