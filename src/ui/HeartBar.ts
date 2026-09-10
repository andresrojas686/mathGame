import Phaser from 'phaser';
import { HEART_EMPTY_KEY, HEART_FULL_KEY } from '../config/themes';

/** Corazones del jugador: SVG lleno/vacío teñidos con el acento del gimnasio. */
export class HeartBar extends Phaser.GameObjects.Container {
  private readonly full: Phaser.GameObjects.Image[] = [];
  private readonly empty: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, total: number, tint: number) {
    super(scene, x, y);
    const size = total > 6 ? 30 : 40;
    const step = size + 8;
    for (let i = 0; i < total; i++) {
      const e = scene.add.image(i * step, 0, HEART_EMPTY_KEY).setDisplaySize(size, size).setTint(tint).setAlpha(0.45);
      const f = scene.add.image(i * step, 0, HEART_FULL_KEY).setDisplaySize(size, size).setTint(tint);
      this.empty.push(e);
      this.full.push(f);
      this.add([e, f]);
    }
    scene.add.existing(this);
  }

  setHearts(n: number, animate = true): void {
    this.full.forEach((img, i) => {
      const on = i < n;
      if (img.visible && !on && animate) {
        this.scene.tweens.add({ targets: img, scale: 0, alpha: 0, duration: 220, ease: 'Back.in', onComplete: () => img.setVisible(false) });
      } else {
        img.setVisible(on);
      }
    });
  }
}
