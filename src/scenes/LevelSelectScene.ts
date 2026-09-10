import Phaser from 'phaser';
import { DIFFICULTIES, DIFFICULTY_IDS, DIFFICULTY_LABELS, timeLimitForWave } from '../config/difficulties';
import { DEFAULT_TRAINER_ID } from '../config/trainers';
import { audio } from '../systems/AudioManager';
import { DIVISION_TIME_FACTOR } from '../systems/BattleState';
import { loadLastOperation, saveLastOperation } from '../systems/Preferences';
import type { BattleParams, DifficultyConfig, DifficultyId, Operation } from '../types';
import { bindWindowKeys } from '../ui/keys';
import { addMuteButton } from '../ui/MuteButton';
import { COLORS, H, UI_FONT, W } from '../ui/style';

interface Card {
  id: DifficultyId;
  box: Phaser.GameObjects.Rectangle;
  detail: Phaser.GameObjects.Text;
}

const OPERATIONS: { id: Operation; label: string; symbol: string }[] = [
  { id: 'multiplicar', label: 'Multiplicar', symbol: '×' },
  { id: 'dividir', label: 'Dividir', symbol: '÷' },
];

export class LevelSelectScene extends Phaser.Scene {
  private name = '';
  private trainer = DEFAULT_TRAINER_ID;
  private operation: Operation = 'multiplicar';
  private cards: Card[] = [];
  private focus = 0;
  private opBoxes: Phaser.GameObjects.Rectangle[] = [];
  private opTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('LevelSelect');
  }

  init(data: { name?: string; trainer?: string }): void {
    this.name = data.name ?? 'Jugador';
    this.trainer = data.trainer ?? DEFAULT_TRAINER_ID;
    this.operation = loadLastOperation();
    this.cards = [];
    this.opBoxes = [];
    this.opTexts = [];
    this.focus = 0;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    audio.playMusic('menu');
    this.add.text(W / 2, 60, `${this.name}, elige operación y gimnasio`, { fontFamily: UI_FONT, fontSize: '40px', color: COLORS.text }).setOrigin(0.5);

    OPERATIONS.forEach((op, i) => {
      const x = W / 2 + (i - 0.5) * 300;
      const box = this.add.rectangle(x, 130, 280, 56, COLORS.field).setStrokeStyle(3, COLORS.fieldBorder).setInteractive({ useHandCursor: true });
      box.on('pointerdown', () => this.setOperation(op.id));
      const text = this.add.text(x, 130, `${op.symbol}  ${op.label}`, { fontFamily: UI_FONT, fontSize: '26px', color: COLORS.text }).setOrigin(0.5);
      this.opBoxes.push(box);
      this.opTexts.push(text);
    });

    const cardW = 340;
    const gap = 40;
    const startX = W / 2 - cardW - gap;
    DIFFICULTY_IDS.forEach((id, i) => this.buildCard(id, startX + i * (cardW + gap), 400, cardW, 350));

    this.add
      .text(W / 2, H - 40, 'M / D cambia la operación · ← → elige · Enter juega · 1, 2, 3 directo · Escape vuelve al líder', {
        fontFamily: UI_FONT,
        fontSize: '17px',
        color: COLORS.muted,
      })
      .setOrigin(0.5);
    addMuteButton(this);

    bindWindowKeys(this, (e) => this.onKey(e));
    this.paint();
  }

  private buildCard(id: DifficultyId, x: number, y: number, w: number, h: number): void {
    const cfg = DIFFICULTIES[id];
    const label = DIFFICULTY_LABELS[id];
    const box = this.add.rectangle(x, y, w, h, COLORS.field).setStrokeStyle(3, COLORS.fieldBorder);
    box.setInteractive({ useHandCursor: true });
    const index = this.cards.length;
    box.on('pointerover', () => {
      this.focus = index;
      this.paint();
    });
    box.on('pointerdown', () => this.choose(id));

    const top = y - h / 2;
    this.add.text(x, top + 45, label.title, { fontFamily: UI_FONT, fontSize: '42px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(x, top + 92, label.theme, { fontFamily: UI_FONT, fontSize: '20px', color: COLORS.accentText }).setOrigin(0.5);

    const heartsY = top + 145;
    const heartsW = Math.min(cfg.hearts, 10) * 28;
    for (let i = 0; i < cfg.hearts; i++) this.add.rectangle(x - heartsW / 2 + 14 + i * 28, heartsY, 22, 22, COLORS.heartOn);
    this.add
      .text(x, heartsY + 28, `${cfg.hearts} ${cfg.hearts === 1 ? 'corazón' : 'corazones'}`, { fontFamily: UI_FONT, fontSize: '18px', color: COLORS.muted })
      .setOrigin(0.5);

    const detail = this.add
      .text(x, top + 245, '', { fontFamily: UI_FONT, fontSize: '20px', color: COLORS.text, align: 'center', lineSpacing: 8 })
      .setOrigin(0.5);
    this.cards.push({ id, box, detail });
  }

  private describe(cfg: DifficultyConfig): string {
    const digits = (list: number[]) => list.join(' o ');
    const plural = (list: number[]) => (Math.max(...list) > 1 ? 'cifras' : 'cifra');
    const time = timeLimitForWave(1, cfg) * (this.operation === 'dividir' ? DIVISION_TIME_FACTOR : 1);
    const line =
      this.operation === 'dividir'
        ? `${digits(cfg.dividendDigits)} cifras ÷ ${digits(cfg.divisorDigits)} ${plural(cfg.divisorDigits)}`
        : `${digits(cfg.multiplicandDigits)} ${plural(cfg.multiplicandDigits)} × ${digits(cfg.multiplierDigits)} ${plural(cfg.multiplierDigits)}`;
    return `${line}\n${time} s por operación`;
  }

  private onKey(e: KeyboardEvent): void {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (e.key === 'ArrowLeft') {
      this.focus = (this.focus + this.cards.length - 1) % this.cards.length;
      this.paint();
    } else if (e.key === 'ArrowRight') {
      this.focus = (this.focus + 1) % this.cards.length;
      this.paint();
    } else if (e.key === 'Enter') {
      this.choose(this.cards[this.focus]!.id);
    } else if (e.key >= '1' && e.key <= '3') {
      const card = this.cards[Number(e.key) - 1];
      if (card) this.choose(card.id);
    } else if (k === 'm') {
      this.setOperation('multiplicar');
    } else if (k === 'd') {
      this.setOperation('dividir');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.setOperation(this.operation === 'dividir' ? 'multiplicar' : 'dividir');
    } else if (e.key === 'Escape') {
      this.scene.start('TrainerSelect', { name: this.name });
    }
  }

  private setOperation(op: Operation): void {
    this.operation = op;
    saveLastOperation(op);
    this.paint();
  }

  private paint(): void {
    this.cards.forEach((c, i) => {
      const active = i === this.focus;
      c.box.setFillStyle(active ? COLORS.fieldActive : COLORS.field);
      c.box.setStrokeStyle(active ? 4 : 3, active ? COLORS.accent : COLORS.fieldBorder);
      c.detail.setText(this.describe(DIFFICULTIES[c.id]));
    });
    OPERATIONS.forEach((op, i) => {
      const active = op.id === this.operation;
      this.opBoxes[i]?.setFillStyle(active ? COLORS.fieldActive : COLORS.field).setStrokeStyle(active ? 4 : 3, active ? COLORS.accent : COLORS.fieldBorder);
      this.opTexts[i]?.setColor(active ? COLORS.accentText : COLORS.text);
    });
  }

  private choose(level: DifficultyId): void {
    const params: BattleParams = { level, operation: this.operation, name: this.name, trainer: this.trainer };
    this.scene.start('Battle', params);
  }
}
