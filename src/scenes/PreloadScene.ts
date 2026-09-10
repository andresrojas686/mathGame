import Phaser from 'phaser';
import { TRAINERS, trainerAssetPath, trainerTextureKey } from '../config/trainers';
import { COLORS, H, UI_FONT, W } from '../ui/style';

/** Carga los recursos locales (sprites de entrenadores) antes del título. Los Pokémon se cargan bajo demanda. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    const label = this.add.text(W / 2, H / 2, 'Cargando…', { fontFamily: UI_FONT, fontSize: '28px', color: COLORS.muted }).setOrigin(0.5);
    this.load.on('progress', (v: number) => label.setText(`Cargando… ${Math.round(v * 100)}%`));
    for (const t of TRAINERS) this.load.image(trainerTextureKey(t.id), trainerAssetPath(t.id));
  }

  create(): void {
    for (const t of TRAINERS) {
      const key = trainerTextureKey(t.id);
      if (this.textures.exists(key)) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.scene.start('Title');
  }
}
