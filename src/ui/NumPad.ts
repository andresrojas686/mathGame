import Phaser from 'phaser';
import type { Palette } from '../config/themes';
import { NUMBER_FONT } from './style';

export type NumPadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'back' | 'ok';

const LAYOUT: NumPadKey[][] = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['0', 'back', 'ok'],
];
const LABELS: Record<NumPadKey, string> = { '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', back: '⌫', ok: '✓' };

export const NUMPAD_KEY = 64;
export const NUMPAD_GAP = 8;

/**
 * Teclado numérico en pantalla (plan.md §5): obligatorio para tablet. Un solo dibujo,
 * teñido con la paleta del gimnasio. La respuesta solo se valida al confirmar.
 */
export class NumPad extends Phaser.GameObjects.Container {
  private readonly keys = new Map<NumPadKey, Phaser.GameObjects.Rectangle>();
  private enabled = true;

  constructor(scene: Phaser.Scene, x: number, y: number, palette: Palette, onKey: (key: NumPadKey) => void) {
    super(scene, x, y);
    const step = NUMPAD_KEY + NUMPAD_GAP;
    const originX = -((LAYOUT[0]!.length - 1) * step) / 2;
    const originY = -((LAYOUT.length - 1) * step) / 2;

    LAYOUT.forEach((row, r) =>
      row.forEach((key, c) => {
        const kx = originX + c * step;
        const ky = originY + r * step;
        const isAction = key === 'back' || key === 'ok';
        const box = scene.add
          .rectangle(kx, ky, NUMPAD_KEY, NUMPAD_KEY, isAction ? palette.primary : palette.bg, 0.9)
          .setStrokeStyle(2, key === 'ok' ? palette.accent : palette.secondary, 0.9);
        const label = scene.add
          .text(kx, ky, LABELS[key], { fontFamily: NUMBER_FONT, fontSize: isAction ? '30px' : '34px', color: palette.text })
          .setOrigin(0.5);
        box.setInteractive({ useHandCursor: true });
        box.on('pointerdown', () => {
          if (!this.enabled) return;
          this.press(box, palette);
          onKey(key);
        });
        this.keys.set(key, box);
        this.add([box, label]);
      }),
    );
    this.setSize(LAYOUT[0]!.length * step, LAYOUT.length * step);
    scene.add.existing(this);
  }

  /** Destello breve, también cuando la tecla llega del teclado físico. */
  flash(key: NumPadKey, palette: Palette): void {
    const box = this.keys.get(key);
    if (box) this.press(box, palette);
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    this.setAlpha(value ? 1 : 0.5);
  }

  private press(box: Phaser.GameObjects.Rectangle, palette: Palette): void {
    const original = box.fillColor;
    box.setFillStyle(palette.accent, 1);
    this.scene.time.delayedCall(80, () => box.setFillStyle(original, 0.9));
  }
}
