import Phaser from 'phaser';
import { DIFFICULTIES, DIFFICULTY_IDS, DIFFICULTY_LABELS, timeLimitForWave } from '../config/difficulties';
import { DEFAULT_TRAINER_ID } from '../config/trainers';
import type { BattleParams, DifficultyId } from '../types';
import { bindWindowKeys } from '../ui/keys';
import { COLORS, H, UI_FONT, W } from '../ui/style';

interface Card {
  id: DifficultyId;
  box: Phaser.GameObjects.Rectangle;
}

export class LevelSelectScene extends Phaser.Scene {
  private name = '';
  private trainer = DEFAULT_TRAINER_ID;
  private cards: Card[] = [];
  private focus = 0;

  constructor() {
    super('LevelSelect');
  }

  init(data: { name?: string; trainer?: string }): void {
    this.name = data.name ?? 'Jugador';
    this.trainer = data.trainer ?? DEFAULT_TRAINER_ID;
    this.cards = [];
    this.focus = 0;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.add
      .text(W / 2, 90, `${this.name}, elige un gimnasio`, { fontFamily: UI_FONT, fontSize: '48px', color: COLORS.text })
      .setOrigin(0.5);

    const cardW = 340;
    const gap = 40;
    const startX = W / 2 - cardW - gap;
    DIFFICULTY_IDS.forEach((id, i) => this.buildCard(id, startX + i * (cardW + gap), 380, cardW, 380));

    this.add
      .text(W / 2, H - 50, '← → para elegir · Enter para jugar · 1, 2, 3 directo · Escape para cambiar de líder', {
        fontFamily: UI_FONT,
        fontSize: '18px',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

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
    this.add.text(x, top + 50, label.title, { fontFamily: UI_FONT, fontSize: '44px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);
    this.add.text(x, top + 100, label.theme, { fontFamily: UI_FONT, fontSize: '22px', color: COLORS.accentText }).setOrigin(0.5);

    const heartsY = top + 160;
    const heartsW = Math.min(cfg.hearts, 10) * 28;
    for (let i = 0; i < cfg.hearts; i++) {
      this.add.rectangle(x - heartsW / 2 + 14 + i * 28, heartsY, 22, 22, COLORS.heartOn);
    }
    this.add
      .text(x, heartsY + 30, `${cfg.hearts} ${cfg.hearts === 1 ? 'corazón' : 'corazones'}`, {
        fontFamily: UI_FONT,
        fontSize: '18px',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    const digits = (list: number[]) => list.map((d) => `${d}`).join(' o ');
    const lines = [
      `${digits(cfg.multiplicandDigits)} cifras × ${digits(cfg.multiplierDigits)} cifra${Math.max(...cfg.multiplierDigits) > 1 ? 's' : ''}`,
      `${timeLimitForWave(1, cfg)} s por operación`,
    ];
    this.add
      .text(x, top + 260, lines.join('\n'), { fontFamily: UI_FONT, fontSize: '20px', color: COLORS.text, align: 'center', lineSpacing: 8 })
      .setOrigin(0.5);

    this.cards.push({ id, box });
  }

  private onKey(e: KeyboardEvent): void {
    if (e.repeat) return;
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
    } else if (e.key === 'Escape') {
      this.scene.start('TrainerSelect', { name: this.name });
    }
  }

  private paint(): void {
    this.cards.forEach((c, i) => {
      const active = i === this.focus;
      c.box.setFillStyle(active ? COLORS.fieldActive : COLORS.field);
      c.box.setStrokeStyle(active ? 4 : 3, active ? COLORS.accent : COLORS.fieldBorder);
    });
  }

  private choose(level: DifficultyId): void {
    const params: BattleParams = { level, operation: 'multiplicar', name: this.name, trainer: this.trainer };
    this.scene.start('Battle', params);
  }
}
