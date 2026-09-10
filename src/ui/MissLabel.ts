import Phaser from 'phaser';
import { UI_FONT } from './style';

/**
 * Único aviso de error del juego (plan.md §9): sube 30 px y se desvanece en 700 ms
 * (400 legible + 300 de fundido). Fallos seguidos no apilan: el existente se reinicia.
 * Con prefers-reduced-motion aparece y se desvanece sin desplazarse. Sin sonido.
 */
export class MissLabel extends Phaser.GameObjects.Text {
  private readonly baseY: number;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, color: string, private readonly reducedMotion: boolean) {
    super(scene, x, y, text, { fontFamily: UI_FONT, fontSize: '40px', fontStyle: 'bold', color });
    this.baseY = y;
    this.setOrigin(0.5).setAlpha(0);
    scene.add.existing(this);
  }

  show(): void {
    this.scene.tweens.killTweensOf(this);
    this.setY(this.baseY).setAlpha(1);
    this.scene.tweens.add({ targets: this, alpha: 0, duration: 300, delay: 400 });
    if (!this.reducedMotion) this.scene.tweens.add({ targets: this, y: this.baseY - 30, duration: 700, ease: 'Quad.out' });
  }
}
