import Phaser from 'phaser';
import { DIFFICULTIES, DIFFICULTY_LABELS, isDifficultyId } from '../config/difficulties';
import { THEMES, type Theme } from '../config/themes';
import { DEFAULT_TRAINER_ID } from '../config/trainers';
import { audio } from '../systems/AudioManager';
import { BattleState } from '../systems/BattleState';
import { missTextFor } from '../systems/FeedbackSettings';
import type { PokemonInfo } from '../systems/pokemon/PokeApi';
import { PokemonSource } from '../systems/pokemon/PokemonSource';
import type { BattleParams, DifficultyId, Operation, Problem, ResultParams } from '../types';
import { HeartBar } from '../ui/HeartBar';
import { HeroView } from '../ui/HeroView';
import { bindWindowKeys, isDigitKey } from '../ui/keys';
import { MissLabel } from '../ui/MissLabel';
import { MonsterView } from '../ui/MonsterView';
import { addMuteButton } from '../ui/MuteButton';
import { NumPad, type NumPadKey } from '../ui/NumPad';
import { H, NUMBER_FONT, prefersReducedMotion, UI_FONT, W } from '../ui/style';
import { SETTINGS_CLOSED_EVENT } from './SettingsScene';

/** Máximo de cifras de un resultado: 99999 × 999 = 99 899 001 → 8 cifras. Una de margen. */
const MAX_ANSWER_DIGITS = 9;
const REVEAL_MS = 500;
const MAX_TICK_MS = 100;
const GAME_OVER_DELAY_MS = 1600;
const LOW_TIME_S = 2;

export class BattleScene extends Phaser.Scene {
  private state!: BattleState;
  private difficulty!: DifficultyId;
  private operation: Operation = 'multiplicar';
  private playerName = '';
  private trainerId = DEFAULT_TRAINER_ID;
  private theme!: Theme;
  private reducedMotion = false;

  private input$ = '';
  private paused = false;
  private settingsOpen = false;
  private revealMsLeft = 0;

  private nextPokemon: Promise<PokemonInfo> | null = null;
  private defeatedNames: string[] = [];
  private pokemonSource = new PokemonSource();

  private layers: Phaser.GameObjects.Image[] = [];
  private heartBar!: HeartBar;
  private correctText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private problemText!: Phaser.GameObjects.Text;
  private timerFill!: Phaser.GameObjects.Rectangle;
  private timerWidth = 600;
  private answerText!: Phaser.GameObjects.Text;
  private answerGroup!: Phaser.GameObjects.Container;
  private missLabel!: MissLabel;
  private pauseLabel!: Phaser.GameObjects.Text;
  private numpad!: NumPad;
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
    this.theme = THEMES[this.difficulty];
    this.state = new BattleState(DIFFICULTIES[this.difficulty], this.operation);
    this.input$ = '';
    this.paused = false;
    this.settingsOpen = false;
    this.revealMsLeft = 0;
    this.nextPokemon = null;
    this.defeatedNames = [];
    this.pokemonSource = new PokemonSource();
    this.layers = [];
    this.reducedMotion = prefersReducedMotion();
  }

  create(): void {
    const p = this.theme.palette;
    this.cameras.main.setBackgroundColor(p.bg);
    this.cameras.main.fadeIn(400);
    this.buildBackground();
    this.buildHud();
    this.buildStage();
    this.buildProblem();
    this.buildAnswer();
    addMuteButton(this, p.text);
    bindWindowKeys(this, (e) => this.onKey(e));
    this.bindFocus();
    this.renderAll();
    void this.spawnFirstPokemon();

    audio.setDetune(this.theme.sfxDetune);
    audio.playMusic(this.difficulty);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audio.setTension(false));
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
    audio.setTension(this.state.hearts === 1 || this.state.timeLeft < LOW_TIME_S);

    if (result.type === 'hit') this.onMonsterAttack(result.lost);
    else if (result.type === 'gameover') this.onGameOver(result.lost);
  }

  // ---------- Pokémon ----------

  private requestPokemon(): Promise<PokemonInfo> {
    return this.pokemonSource.next();
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

  private buildBackground(): void {
    this.theme.layers.forEach((key, i) => {
      if (!this.textures.exists(key)) return;
      this.layers.push(this.add.image(W / 2, H / 2, key).setDepth(-10 + i));
    });
  }

  private buildHud(): void {
    const p = this.theme.palette;
    const cfg = DIFFICULTIES[this.difficulty];
    this.heartBar = new HeartBar(this, 56, 48, cfg.hearts, p.accent);
    this.correctText = this.add.text(W - 40, 40, '', { fontFamily: UI_FONT, fontSize: '32px', color: p.text }).setOrigin(1, 0.5);
    this.waveText = this.add.text(W - 40, 74, '', { fontFamily: UI_FONT, fontSize: '20px', color: p.muted }).setOrigin(1, 0.5);
    const opLabel = this.operation === 'dividir' ? 'División' : 'Multiplicación';
    this.add
      .text(W / 2, 48, `${this.playerName} · ${DIFFICULTY_LABELS[this.difficulty].title} · ${opLabel}`, { fontFamily: UI_FONT, fontSize: '20px', color: p.muted })
      .setOrigin(0.5);
    this.pauseLabel = this.add
      .text(W / 2, H / 2, 'PAUSA', { fontFamily: UI_FONT, fontSize: '64px', color: p.text })
      .setOrigin(0.5)
      .setDepth(50)
      .setVisible(false);
  }

  private buildStage(): void {
    this.hero = new HeroView(this, 200, 330, this.trainerId, this.reducedMotion);
    this.monster = new MonsterView(this, 1080, 340, this.reducedMotion);
    this.monster.localFallback = (id) => this.pokemonSource.localFor(id);
    if (!this.reducedMotion) this.tweens.add({ targets: this.hero, y: '+=8', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  private buildProblem(): void {
    const p = this.theme.palette;
    // La operación nunca se disfraza: misma tipografía, tamaño y contraste en los tres gimnasios.
    this.add.rectangle(W / 2, 290, 620, 130, p.bg, 0.55).setStrokeStyle(2, p.secondary, 0.6);
    this.problemText = this.add.text(W / 2, 290, '', { fontFamily: NUMBER_FONT, fontSize: '96px', color: p.text }).setOrigin(0.5);
    const y = 372;
    this.add.rectangle(W / 2, y, this.timerWidth, 22, p.bg, 0.8).setStrokeStyle(1, p.secondary, 0.5);
    this.timerFill = this.add.rectangle(W / 2 - this.timerWidth / 2, y, this.timerWidth, 22, p.secondary).setOrigin(0, 0.5);
  }

  private buildAnswer(): void {
    const p = this.theme.palette;
    const box = this.add.rectangle(0, 0, 340, 80, p.bg, 0.85).setStrokeStyle(3, p.accent);
    this.answerText = this.add.text(0, 0, '', { fontFamily: NUMBER_FONT, fontSize: '54px', color: p.text }).setOrigin(0.5);
    this.answerGroup = this.add.container(500, 545, [box, this.answerText]);
    this.missLabel = new MissLabel(this, 500, 480, missTextFor(audio.settings), `#${p.accent.toString(16).padStart(6, '0')}`, this.reducedMotion);
    this.numpad = new NumPad(this, 846, 555, p, (key) => this.onPadKey(key));
    this.add.text(500, 600, 'Enter confirma · Esc pausa y ajustes', { fontFamily: UI_FONT, fontSize: '16px', color: p.muted }).setOrigin(0.5);
  }

  private bindFocus(): void {
    const ev = this.game.events;
    const pause = () => this.setPaused(true);
    const resume = () => {
      if (!this.settingsOpen) this.setPaused(false);
    };
    ev.on(Phaser.Core.Events.BLUR, pause);
    ev.on(Phaser.Core.Events.HIDDEN, pause);
    ev.on(Phaser.Core.Events.FOCUS, resume);
    ev.on(Phaser.Core.Events.VISIBLE, resume);
    const onSettingsClosed = () => {
      this.settingsOpen = false;
      this.missLabel.setText(missTextFor(audio.settings));
      this.setPaused(false);
    };
    ev.on(SETTINGS_CLOSED_EVENT, onSettingsClosed);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      ev.off(Phaser.Core.Events.BLUR, pause);
      ev.off(Phaser.Core.Events.HIDDEN, pause);
      ev.off(Phaser.Core.Events.FOCUS, resume);
      ev.off(Phaser.Core.Events.VISIBLE, resume);
      ev.off(SETTINGS_CLOSED_EVENT, onSettingsClosed);
    });
  }

  // ---------- entrada ----------

  private onKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') {
      if (!this.settingsOpen && !this.state.over && !event.repeat) this.openSettings();
      return;
    }
    const digit = isDigitKey(event);
    if (!digit && event.key !== 'Backspace' && event.key !== 'Enter') return;
    event.preventDefault();
    if (this.state.over || this.paused || this.revealMsLeft > 0) return;

    if (digit) {
      this.numpad.flash(event.key as NumPadKey, this.theme.palette);
      this.typeDigit(event.key);
    } else if (event.key === 'Backspace') {
      this.numpad.flash('back', this.theme.palette);
      this.backspace();
    } else if (!event.repeat) {
      this.numpad.flash('ok', this.theme.palette);
      this.confirm();
    }
  }

  private onPadKey(key: NumPadKey): void {
    if (this.state.over || this.paused || this.revealMsLeft > 0) return;
    if (key === 'back') this.backspace();
    else if (key === 'ok') this.confirm();
    else this.typeDigit(key);
  }

  private typeDigit(d: string): void {
    audio.playSfx('key');
    if (this.input$.length >= MAX_ANSWER_DIGITS) return;
    this.input$ += d;
    this.renderAnswer();
  }

  private backspace(): void {
    audio.playSfx('key');
    this.input$ = this.input$.slice(0, -1);
    this.renderAnswer();
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

  private openSettings(): void {
    this.settingsOpen = true;
    this.setPaused(true);
    this.scene.launch('Settings', { overlay: true });
  }

  // ---------- eventos del bucle ----------

  private onCorrect(): void {
    audio.playSfx('correct');
    this.renderHud();
    this.renderProblem();
    this.hero.attack();
    this.monster.hit();
  }

  private onMonsterDefeated(): void {
    audio.playSfx('defeated');
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
    // Sin sonido: el aviso es visual.
    this.missLabel.show();
    if (this.reducedMotion) return;
    this.tweens.killTweensOf(this.answerGroup);
    this.tweens.add({
      targets: this.answerGroup,
      x: { from: 490, to: 510 },
      duration: 50,
      yoyo: true,
      repeat: 3,
      onComplete: () => (this.answerGroup.x = 500),
    });
  }

  private onMonsterAttack(lost: Problem): void {
    audio.playSfx('attack');
    this.input$ = '';
    this.renderAnswer();
    this.renderHud();
    this.showReveal(lost);
    this.shake(250, 0.012);
    this.monster.lunge();
    this.hero.hit();
  }

  private onGameOver(lost: Problem): void {
    audio.playSfx('gameover');
    audio.setTension(false);
    this.renderHud();
    this.showReveal(lost);
    this.shake(400, 0.02);
    this.numpad.setEnabled(false);
    this.time.delayedCall(GAME_OVER_DELAY_MS - 500, () => this.cameras.main.fadeOut(500));
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
      this.scene.start('Result', params);
    });
  }

  private setPaused(value: boolean): void {
    if (this.state.over) return;
    this.paused = value;
    this.pauseLabel.setVisible(value && !this.settingsOpen);
  }

  /** Sacudida de cámara con parallax leve de las capas de fondo. */
  private shake(ms: number, intensity: number): void {
    if (this.reducedMotion) return;
    this.cameras.main.shake(ms, intensity);
    this.layers.forEach((layer, i) => {
      if (i === 0) return;
      this.tweens.killTweensOf(layer);
      this.tweens.add({ targets: layer, x: W / 2 + 4 * i, duration: 60, yoyo: true, repeat: 2, onComplete: () => (layer.x = W / 2) });
    });
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
    this.heartBar.setHearts(s.hearts);
    this.correctText.setText(`Aciertos: ${s.correct}`);
    this.waveText.setText(`Oleada ${s.wave} · ${s.timeLimit} s`);
    this.monster.setHp(s.monsterHp, s.monsterMaxHp);
  }

  private renderProblem(): void {
    this.problemText.setText(this.state.problem.text).setColor(this.theme.palette.text);
    this.renderTimer(0);
  }

  private showReveal(lost: Problem): void {
    const p = this.theme.palette;
    this.problemText.setText(`${lost.text} = ${lost.answer}`).setColor(`#${p.accent.toString(16).padStart(6, '0')}`);
    this.revealMsLeft = REVEAL_MS;
    this.timerFill.width = 0;
  }

  private renderAnswer(): void {
    this.answerText.setText(this.input$);
  }

  private renderTimer(time: number): void {
    const p = this.theme.palette;
    const ratio = this.state.timeLimit > 0 ? this.state.timeLeft / this.state.timeLimit : 0;
    this.timerFill.width = this.timerWidth * ratio;
    const low = this.state.timeLeft < LOW_TIME_S;
    this.timerFill.setFillStyle(low ? p.dangerHex : p.secondary);
    this.timerFill.setAlpha(low && !this.reducedMotion ? 0.65 + 0.35 * Math.sin(time / 70) : 1);
  }
}
