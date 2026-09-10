import Phaser from 'phaser';
import { trainerById, trainerTextureKey } from '../config/trainers';
import { COLORS, UI_FONT } from './style';

const SPRITE_SCALE = 2.5;

/** El jugador: sprite del líder de gimnasio elegido, con embestida al acertar y destello al recibir daño. */
export class HeroView extends Phaser.GameObjects.Container {
  private readonly sprite: Phaser.GameObjects.Image | null;
  private readonly placeholder: Phaser.GameObjects.Rectangle | null;
  private readonly homeX: number;
  private readonly reducedMotion: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, trainerId: string, reducedMotion: boolean) {
    super(scene, x, y);
    this.homeX = x;
    this.reducedMotion = reducedMotion;
    const trainer = trainerById(trainerId);
    const key = trainerTextureKey(trainer.id);

    if (scene.textures.exists(key)) {
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.sprite = scene.add.image(0, 0, key).setScale(SPRITE_SCALE);
      this.placeholder = null;
      this.add(this.sprite);
    } else {
      this.sprite = null;
      this.placeholder = scene.add.rectangle(0, 0, 120, 180, COLORS.hero);
      this.add(this.placeholder);
    }
    this.add(scene.add.text(0, 120, trainer.name, { fontFamily: UI_FONT, fontSize: '20px', color: COLORS.text }).setOrigin(0.5));
    scene.add.existing(this);
  }

  attack(): void {
    if (this.reducedMotion) return;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({ targets: this, x: this.homeX + 60, duration: 120, yoyo: true, ease: 'Quad.out', onComplete: () => (this.x = this.homeX) });
  }

  hit(): void {
    if (this.sprite) {
      this.sprite.setTintFill(0xffffff);
      this.scene.time.delayedCall(90, () => this.sprite?.clearTint());
    } else if (this.placeholder) {
      const c = this.placeholder.fillColor;
      this.placeholder.setFillStyle(0xffffff);
      this.scene.time.delayedCall(90, () => this.placeholder?.setFillStyle(c));
    }
  }
}
