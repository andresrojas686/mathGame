import Phaser from 'phaser';
import { DIFFICULTIES, DIFFICULTY_IDS, DIFFICULTY_LABELS, timeLimitForWave } from '../config/difficulties';
import { CLASSIC_OPERATIONS, MODES, OPERATIONS_BY_ID, operationFor, type OperationKind } from '../config/operations';
import { RETO_BACK, RETO_TIME, retoConfig } from '../config/reto';
import { DEFAULT_TRAINER_ID } from '../config/trainers';
import { audio } from '../systems/AudioManager';
import { getOnlineIntent } from '../systems/online/session';
import { loadLastOperation, saveLastOperation } from '../systems/Preferences';
import type { ArithOp, BattleParams, DifficultyConfig, DifficultyId, Operation } from '../types';
import { bindWindowKeys } from '../ui/keys';
import { addMuteButton } from '../ui/MuteButton';
import { COLORS, H, UI_FONT, W } from '../ui/style';

interface Card {
  id: DifficultyId;
  box: Phaser.GameObjects.Rectangle;
  detail: Phaser.GameObjects.Text;
}

interface Toggle {
  box: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

const MODE_Y = 118;
const OP_Y = 186;

export class LevelSelectScene extends Phaser.Scene {
  private name = '';
  private trainer = DEFAULT_TRAINER_ID;
  private kind: OperationKind = 'clasico';
  /** Operación base del modo clásico y del reto. Se conserva al pasar por la mezcla. */
  private base: ArithOp = 'multiplicar';
  private cards: Card[] = [];
  private focus = 0;
  private modeToggles: Toggle[] = [];
  private opToggles: Toggle[] = [];

  constructor() {
    super('LevelSelect');
  }

  init(data: { name?: string; trainer?: string }): void {
    this.name = data.name ?? 'Jugador';
    this.trainer = data.trainer ?? DEFAULT_TRAINER_ID;
    const last = OPERATIONS_BY_ID[loadLastOperation()];
    this.kind = last.kind;
    this.base = last.base ?? 'multiplicar';
    this.cards = [];
    this.modeToggles = [];
    this.opToggles = [];
    this.focus = 0;
  }

  private get operation(): Operation {
    return operationFor(this.kind, this.base);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    audio.playMusic('menu');
    this.add.text(W / 2, 52, `${this.name}, elige modo, operación y gimnasio`, { fontFamily: UI_FONT, fontSize: '38px', color: COLORS.text }).setOrigin(0.5);

    MODES.forEach((mode, i) => {
      const x = W / 2 + (i - (MODES.length - 1) / 2) * 290;
      this.modeToggles.push(this.toggle(x, MODE_Y, 270, mode.label, () => this.setKind(mode.id)));
    });
    CLASSIC_OPERATIONS.forEach((op, i) => {
      const x = W / 2 + (i - (CLASSIC_OPERATIONS.length - 1) / 2) * 260;
      this.opToggles.push(this.toggle(x, OP_Y, 240, `${op.symbol}  ${op.label}`, () => this.setBase(op.base!)));
    });

    const cardW = 340;
    const gap = 40;
    const startX = W / 2 - cardW - gap;
    DIFFICULTY_IDS.forEach((id, i) => this.buildCard(id, startX + i * (cardW + gap), 440, cardW, 340));

    this.add
      .text(W / 2, H - 40, '↑ ↓ modo · M / D / S / R operación · ← → elige · Enter juega · 1, 2, 3 directo · Escape vuelve al líder', {
        fontFamily: UI_FONT,
        fontSize: '17px',
        color: COLORS.muted,
      })
      .setOrigin(0.5);
    addMuteButton(this);

    bindWindowKeys(this, (e) => this.onKey(e));
    this.paint();
  }

  private toggle(x: number, y: number, width: number, label: string, onClick: () => void): Toggle {
    const box = this.add.rectangle(x, y, width, 52, COLORS.field).setStrokeStyle(3, COLORS.fieldBorder).setInteractive({ useHandCursor: true });
    box.on('pointerdown', onClick);
    const text = this.add.text(x, y, label, { fontFamily: UI_FONT, fontSize: '24px', color: COLORS.text }).setOrigin(0.5);
    return { box, text };
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
    this.add.text(x, top + 42, label.title, { fontFamily: UI_FONT, fontSize: '40px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(x, top + 86, label.theme, { fontFamily: UI_FONT, fontSize: '20px', color: COLORS.accentText }).setOrigin(0.5);

    const heartsY = top + 132;
    const heartsW = Math.min(cfg.hearts, 10) * 28;
    for (let i = 0; i < cfg.hearts; i++) this.add.rectangle(x - heartsW / 2 + 14 + i * 28, heartsY, 22, 22, COLORS.heartOn);
    this.add
      .text(x, heartsY + 28, `${cfg.hearts} ${cfg.hearts === 1 ? 'corazón' : 'corazones'}`, { fontFamily: UI_FONT, fontSize: '18px', color: COLORS.muted })
      .setOrigin(0.5);

    const detail = this.add
      .text(x, top + 250, '', { fontFamily: UI_FONT, fontSize: '20px', color: COLORS.text, align: 'center', lineSpacing: 8 })
      .setOrigin(0.5);
    this.cards.push({ id, box, detail });
  }

  /** Cifras de cada operando para una operación y una configuración, ej. "1 o 2 cifras + 1 o 2 cifras". */
  private digitsLine(base: ArithOp, cfg: DifficultyConfig): string {
    const digits = (list: number[]) => list.join(' o ');
    const plural = (list: number[]) => (Math.max(...list) > 1 ? 'cifras' : 'cifra');
    const operands = (a: number[], b: number[]) => `${digits(a)} ${plural(a)} ${OPERATIONS_BY_ID[base].symbol} ${digits(b)} ${plural(b)}`;
    const lines: Record<ArithOp, string> = {
      multiplicar: operands(cfg.multiplicandDigits, cfg.multiplierDigits),
      dividir: operands(cfg.dividendDigits, cfg.divisorDigits),
      sumar: operands(cfg.addendDigits, cfg.addendDigits),
      restar: operands(cfg.minuendDigits, cfg.subtrahendDigits),
    };
    return lines[base];
  }

  private describe(cfg: DifficultyConfig): string {
    if (this.kind === 'mezcla') {
      const time = timeLimitForWave(1, cfg);
      return `× ÷ + − al azar\ncon las cifras de cada una\n${time} s por operación (÷ el doble)`;
    }
    if (this.kind === 'reto') {
      const back = RETO_BACK[cfg.id];
      const steps = back === 1 ? 'la operación anterior' : `${back} operaciones atrás`;
      return `${this.digitsLine(this.base, retoConfig(cfg.id))}\nresponde ${steps}\n${RETO_TIME} s por respuesta`;
    }
    const time = timeLimitForWave(1, cfg) * OPERATIONS_BY_ID[this.base].timeFactor;
    return `${this.digitsLine(this.base, cfg)}\n${time} s por operación`;
  }

  private onKey(e: KeyboardEvent): void {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    const byKey = CLASSIC_OPERATIONS.find((op) => op.key === k);
    if (e.key === 'ArrowLeft') {
      this.focus = (this.focus + this.cards.length - 1) % this.cards.length;
      this.paint();
    } else if (e.key === 'ArrowRight') {
      this.focus = (this.focus + 1) % this.cards.length;
      this.paint();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const i = MODES.findIndex((m) => m.id === this.kind);
      const step = e.key === 'ArrowDown' ? 1 : MODES.length - 1;
      this.setKind(MODES[(i + step) % MODES.length]!.id);
    } else if (e.key === 'Enter') {
      this.choose(this.cards[this.focus]!.id);
    } else if (e.key >= '1' && e.key <= '3') {
      const card = this.cards[Number(e.key) - 1];
      if (card) this.choose(card.id);
    } else if (byKey) {
      this.setBase(byKey.base!);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const i = CLASSIC_OPERATIONS.findIndex((op) => op.base === this.base);
      this.setBase(CLASSIC_OPERATIONS[(i + 1) % CLASSIC_OPERATIONS.length]!.base!);
    } else if (e.key === 'Escape') {
      this.scene.start('TrainerSelect', { name: this.name });
    }
  }

  private setKind(kind: OperationKind): void {
    this.kind = kind;
    this.save();
  }

  /** Elegir una operación desde la mezcla vuelve al modo clásico: la mezcla no tiene operación base. */
  private setBase(base: ArithOp): void {
    this.base = base;
    if (this.kind === 'mezcla') this.kind = 'clasico';
    this.save();
  }

  private save(): void {
    saveLastOperation(this.operation);
    this.paint();
  }

  private paintToggle(t: Toggle, active: boolean, enabled = true): void {
    t.box.setFillStyle(active ? COLORS.fieldActive : COLORS.field).setStrokeStyle(active ? 4 : 3, active ? COLORS.accent : COLORS.fieldBorder);
    t.text.setColor(active ? COLORS.accentText : enabled ? COLORS.text : COLORS.muted);
    t.box.setAlpha(enabled ? 1 : 0.5);
    t.text.setAlpha(enabled ? 1 : 0.5);
  }

  private paint(): void {
    this.cards.forEach((c, i) => {
      const active = i === this.focus;
      c.box.setFillStyle(active ? COLORS.fieldActive : COLORS.field);
      c.box.setStrokeStyle(active ? 4 : 3, active ? COLORS.accent : COLORS.fieldBorder);
      c.detail.setText(this.describe(DIFFICULTIES[c.id]));
    });
    MODES.forEach((mode, i) => this.paintToggle(this.modeToggles[i]!, mode.id === this.kind));
    const mixed = this.kind === 'mezcla';
    CLASSIC_OPERATIONS.forEach((op, i) => this.paintToggle(this.opToggles[i]!, !mixed && op.base === this.base, !mixed));
  }

  private choose(level: DifficultyId): void {
    const params: BattleParams = { level, operation: this.operation, name: this.name, trainer: this.trainer };
    if (getOnlineIntent()?.mode === 'create') {
      this.scene.start('Lobby', { ...params });
      return;
    }
    this.scene.start('Battle', params);
  }
}
