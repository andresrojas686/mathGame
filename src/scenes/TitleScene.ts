import Phaser from 'phaser';
import { isDifficultyId } from '../config/difficulties';
import { DEFAULT_TRAINER_ID } from '../config/trainers';
import { loadLastName, loadLastTrainer } from '../systems/Preferences';
import { scores } from '../systems/scores/ScoreService';
import type { BattleParams } from '../types';
import { Button } from '../ui/Button';
import { bindWindowKeys } from '../ui/keys';
import { COLORS, H, UI_FONT, W } from '../ui/style';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    // Puntuaciones que no se pudieron enviar en partidas anteriores.
    void scores.flushPending();

    // Atajo de desarrollo: ?level=normal salta directo al combate con el último nombre y entrenador.
    const level = new URLSearchParams(window.location.search).get('level');
    if (isDifficultyId(level)) {
      const params: BattleParams = {
        level,
        operation: 'multiplicar',
        name: loadLastName() || 'Jugador',
        trainer: loadLastTrainer() || DEFAULT_TRAINER_ID,
      };
      this.scene.start('Battle', params);
      return;
    }

    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.add
      .text(W / 2, H / 2 - 140, 'Multiplicón', { fontFamily: UI_FONT, fontSize: '96px', fontStyle: 'bold', color: COLORS.text })
      .setOrigin(0.5);
    this.add
      .text(W / 2, H / 2 - 60, 'Resuelve multiplicaciones antes de que el Pokémon ataque', {
        fontFamily: UI_FONT,
        fontSize: '24px',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    const play = () => this.scene.start('Name');
    const ranking = () => this.scene.start('Leaderboard', {});
    new Button(this, W / 2, H / 2 + 40, 'Jugar', play).setFocused(true);
    new Button(this, W / 2, H / 2 + 130, 'Ranking', ranking, { height: 60, fontSize: '26px' });
    this.add
      .text(W / 2, H / 2 + 200, 'Enter para empezar · R para el ranking', { fontFamily: UI_FONT, fontSize: '18px', color: COLORS.muted })
      .setOrigin(0.5);

    bindWindowKeys(this, (e) => {
      if (e.repeat) return;
      if (e.key === 'Enter') play();
      else if (e.key === 'r' || e.key === 'R') ranking();
    });
  }
}
