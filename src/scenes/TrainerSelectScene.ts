import Phaser from 'phaser';
import { TRAINERS, trainerTextureKey } from '../config/trainers';
import { loadLastTrainer, saveLastTrainer } from '../systems/Preferences';
import { bindWindowKeys } from '../ui/keys';
import { COLORS, H, UI_FONT, W } from '../ui/style';

const COLS = 6;
const CELL_W = 180;
const CELL_H = 200;
const SPRITE_SCALE = 2.2;

export class TrainerSelectScene extends Phaser.Scene {
  private name = '';
  private focus = 0;
  private boxes: Phaser.GameObjects.Rectangle[] = [];
  private gymText!: Phaser.GameObjects.Text;

  constructor() {
    super('TrainerSelect');
  }

  init(data: { name?: string }): void {
    this.name = data.name ?? 'Jugador';
    this.boxes = [];
    const last = loadLastTrainer();
    const idx = TRAINERS.findIndex((t) => t.id === last);
    this.focus = idx >= 0 ? idx : 0;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.add
      .text(W / 2, 70, `${this.name}, elige tu líder de gimnasio`, { fontFamily: UI_FONT, fontSize: '44px', color: COLORS.text })
      .setOrigin(0.5);

    const rows = Math.ceil(TRAINERS.length / COLS);
    const gridW = COLS * CELL_W;
    const startX = W / 2 - gridW / 2 + CELL_W / 2;
    const startY = 200;

    TRAINERS.forEach((t, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = startX + col * CELL_W;
      const y = startY + row * CELL_H;
      const box = this.add.rectangle(x, y, CELL_W - 16, CELL_H - 16, COLORS.field).setStrokeStyle(3, COLORS.fieldBorder);
      box.setInteractive({ useHandCursor: true });
      box.on('pointerover', () => {
        this.focus = i;
        this.paint();
      });
      box.on('pointerdown', () => this.choose());
      const key = trainerTextureKey(t.id);
      if (this.textures.exists(key)) this.add.image(x, y - 20, key).setScale(SPRITE_SCALE);
      else this.add.rectangle(x, y - 20, 60, 80, COLORS.hero);
      this.add.text(x, y + 65, t.name, { fontFamily: UI_FONT, fontSize: '20px', color: COLORS.text }).setOrigin(0.5);
      this.boxes.push(box);
    });

    this.gymText = this.add
      .text(W / 2, startY + rows * CELL_H - 10, '', { fontFamily: UI_FONT, fontSize: '22px', color: COLORS.accentText })
      .setOrigin(0.5);
    this.add
      .text(W / 2, H - 40, 'flechas para elegir · Enter para continuar · Escape para cambiar el nombre', {
        fontFamily: UI_FONT,
        fontSize: '18px',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    bindWindowKeys(this, (e) => this.onKey(e));
    this.paint();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.repeat) return;
    const n = TRAINERS.length;
    if (e.key === 'ArrowLeft') this.focus = (this.focus + n - 1) % n;
    else if (e.key === 'ArrowRight') this.focus = (this.focus + 1) % n;
    else if (e.key === 'ArrowUp') this.focus = (this.focus + n - COLS) % n;
    else if (e.key === 'ArrowDown') this.focus = (this.focus + COLS) % n;
    else if (e.key === 'Enter') return this.choose();
    else if (e.key === 'Escape') {
      this.scene.start('Name');
      return;
    } else return;
    e.preventDefault();
    this.paint();
  }

  private paint(): void {
    this.boxes.forEach((b, i) => {
      const active = i === this.focus;
      b.setFillStyle(active ? COLORS.fieldActive : COLORS.field);
      b.setStrokeStyle(active ? 4 : 3, active ? COLORS.accent : COLORS.fieldBorder);
    });
    this.gymText.setText(TRAINERS[this.focus]?.gym ?? '');
  }

  private choose(): void {
    const trainer = TRAINERS[this.focus]!;
    saveLastTrainer(trainer.id);
    this.scene.start('LevelSelect', { name: this.name, trainer: trainer.id });
  }
}
