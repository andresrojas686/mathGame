import Phaser from 'phaser';
import { COLORS, UI_FONT } from './style';

export interface ButtonOptions {
  width?: number;
  height?: number;
  fontSize?: string;
}

/**
 * Botón provisional de Fase 2: rectángulo con texto, respuesta al puntero y foco visible
 * para navegación por teclado. Los marcos por tema llegan en Fase 4.
 */
export class Button extends Phaser.GameObjects.Container {
  private readonly box: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private focused = false;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, onClick: () => void, opts: ButtonOptions = {}) {
    super(scene, x, y);
    const width = opts.width ?? 320;
    const height = opts.height ?? 72;

    this.box = scene.add.rectangle(0, 0, width, height, COLORS.field).setStrokeStyle(3, COLORS.fieldBorder);
    this.label = scene.add
      .text(0, 0, text, { fontFamily: UI_FONT, fontSize: opts.fontSize ?? '30px', color: COLORS.text })
      .setOrigin(0.5);
    this.add([this.box, this.label]);
    this.setSize(width, height);

    this.setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.paint(true))
      .on('pointerout', () => this.paint(false))
      .on('pointerdown', () => onClick());

    scene.add.existing(this);
  }

  setFocused(value: boolean): this {
    this.focused = value;
    this.paint(false);
    return this;
  }

  private paint(hover: boolean): void {
    const active = hover || this.focused;
    this.box.setFillStyle(active ? COLORS.fieldActive : COLORS.field);
    this.box.setStrokeStyle(active ? 4 : 3, active ? COLORS.accent : COLORS.fieldBorder);
  }
}
