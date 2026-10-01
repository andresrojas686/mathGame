import Phaser from 'phaser';
import { isDifficultyId } from '../config/difficulties';
import { DEFAULT_TRAINER_ID } from '../config/trainers';
import { audio } from '../systems/AudioManager';
import { loadLastName, loadLastOperation, loadLastTrainer } from '../systems/Preferences';
import { roomCodeFromUrl, setOnlineIntent } from '../systems/online/session';
import { scores } from '../systems/scores/ScoreService';
import type { BattleParams } from '../types';
import { Button } from '../ui/Button';
import { bindWindowKeys } from '../ui/keys';
import { addMuteButton } from '../ui/MuteButton';
import { COLORS, H, UI_FONT, W } from '../ui/style';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    // Puntuaciones que no se pudieron enviar en partidas anteriores.
    void scores.flushPending();

    // Atajo de desarrollo: ?level=normal[&op=dividir] salta directo al combate con el último nombre y entrenador.
    const query = new URLSearchParams(window.location.search);
    const level = query.get('level');
    if (isDifficultyId(level)) {
      const params: BattleParams = {
        level,
        operation: query.get('op') === 'dividir' ? 'dividir' : loadLastOperation(),
        name: loadLastName() || 'Jugador',
        trainer: loadLastTrainer() || DEFAULT_TRAINER_ID,
      };
      this.scene.start('Battle', params);
      return;
    }

    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.cameras.main.fadeIn(300);
    audio.playMusic('menu');

    this.add
      .text(W / 2, H / 2 - 170, 'Multiplicón', { fontFamily: UI_FONT, fontSize: '96px', fontStyle: 'bold', color: COLORS.text })
      .setOrigin(0.5);
    this.add
      .text(W / 2, H / 2 - 90, 'Multiplica o divide antes de que el Pokémon ataque', { fontFamily: UI_FONT, fontSize: '24px', color: COLORS.muted })
      .setOrigin(0.5);

    // Enlace compartido (?sala=AB2CD): el camino directo pasa a ser entrar a esa sala.
    const invited = roomCodeFromUrl();

    const play = () => {
      setOnlineIntent(null);
      this.scene.start('Name');
    };
    const online = () => {
      setOnlineIntent(invited ? { mode: 'join', code: invited } : { mode: 'create' });
      this.scene.start('Name');
    };
    const ranking = () => this.scene.start('Leaderboard', {});
    const settings = () => this.scene.start('Settings', { returnTo: 'Title' });

    new Button(this, W / 2, H / 2 - 20, invited ? `Entrar a la sala ${invited}` : 'Jugar', invited ? online : play, {
      width: invited ? 460 : 320,
    }).setFocused(true);
    new Button(this, W / 2, H / 2 + 65, invited ? 'Jugar en solitario' : 'Jugar con amigos', invited ? play : online, {
      width: 360,
      height: 64,
      fontSize: '26px',
    });
    new Button(this, W / 2 - 170, H / 2 + 150, 'Ranking', ranking, { width: 300, height: 60, fontSize: '26px' });
    new Button(this, W / 2 + 170, H / 2 + 150, 'Ajustes', settings, { width: 300, height: 60, fontSize: '26px' });
    this.add
      .text(W / 2, H / 2 + 212, 'Enter empieza · J juega con amigos · R ranking · A ajustes · M silencio', {
        fontFamily: UI_FONT,
        fontSize: '18px',
        color: COLORS.muted,
      })
      .setOrigin(0.5);
    addMuteButton(this);

    bindWindowKeys(this, (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (e.key === 'Enter') (invited ? online : play)();
      else if (k === 'j') online();
      else if (k === 'r') ranking();
      else if (k === 'a') settings();
      else if (k === 'm') audio.toggleMute();
    });
  }
}
