import Phaser from 'phaser';
import { isDifficultyId } from '../config/difficulties';
import { loadLastName } from '../systems/Preferences';
import type { BattleParams } from '../types';
import { Button } from '../ui/Button';
import { bindWindowKeys } from '../ui/keys';
import { COLORS, H, UI_FONT, W } from '../ui/style';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    // Atajo de desarrollo: ?level=normal salta directo al combate con el último nombre.
    const level = new URLSearchParams(window.location.search).get('level');
    if (isDifficultyId(level)) {
      const params: BattleParams = { level, name: loadLastName() || 'Jugador' };
      this.scene.start('Battle', params);
      return;
    }

    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.add
      .text(W / 2, H / 2 - 120, 'Multiplicón', { fontFamily: UI_FONT, fontSize: '96px', fontStyle: 'bold', color: COLORS.text })
      .setOrigin(0.5);
    this.add
      .text(W / 2, H / 2 - 40, 'Resuelve multiplicaciones antes de que el monstruo ataque', {
        fontFamily: UI_FONT,
        fontSize: '24px',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    const play = () => this.scene.start('Name');
    new Button(this, W / 2, H / 2 + 70, 'Jugar', play).setFocused(true);
    this.add
      .text(W / 2, H / 2 + 140, 'Enter para empezar', { fontFamily: UI_FONT, fontSize: '18px', color: COLORS.muted })
      .setOrigin(0.5);

    bindWindowKeys(this, (e) => {
      if (e.key === 'Enter' && !e.repeat) play();
    });
  }
}
