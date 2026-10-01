import Phaser from 'phaser';
import { DIFFICULTY_LABELS } from '../config/difficulties';
import { audio } from '../systems/AudioManager';
import type { RoomView } from '../systems/online/protocol';
import { roomClient, type RoomEvent } from '../systems/online/RoomClient';
import { clearOnlineIntent } from '../systems/online/session';
import { scores } from '../systems/scores/ScoreService';
import type { ResultParams } from '../types';
import { Button } from '../ui/Button';
import { bindWindowKeys } from '../ui/keys';
import { addMuteButton } from '../ui/MuteButton';
import { RoomScoreboard } from '../ui/RoomScoreboard';
import { COLORS, H, NUMBER_FONT, UI_FONT, W } from '../ui/style';

export interface RoomResultParams extends ResultParams {
  online: { seed: number; code: string };
}

/**
 * Cierre de una partida de sala: marcador de todos, puesto propio y, en paralelo,
 * el envío al ranking de siempre. Una partida entre amigos también cuenta para el ranking.
 */
export class RoomResultScene extends Phaser.Scene {
  private params!: RoomResultParams;
  private scoreboard!: RoomScoreboard;
  private headline!: Phaser.GameObjects.Text;
  private waitingText!: Phaser.GameObjects.Text;
  private globalText!: Phaser.GameObjects.Text;
  private againButton: Button | null = null;
  private unsubscribe: (() => void) | null = null;
  private alive = true;

  constructor() {
    super('RoomResult');
  }

  init(data: RoomResultParams): void {
    this.params = data;
    this.alive = true;
    this.againButton = null;
  }

  create(): void {
    const p = this.params;
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.cameras.main.fadeIn(300);
    audio.playMusic('menu');
    addMuteButton(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.alive = false;
      this.unsubscribe?.();
      this.unsubscribe = null;
    });

    const opLabel = p.operation === 'dividir' ? 'División' : 'Multiplicación';
    this.add.text(W / 2, 50, `Sala ${p.online.code}`, { fontFamily: UI_FONT, fontSize: '40px', color: COLORS.text }).setOrigin(0.5);
    this.add
      .text(W / 2, 92, `${opLabel} · ${DIFFICULTY_LABELS[p.level].title}`, { fontFamily: UI_FONT, fontSize: '20px', color: COLORS.muted })
      .setOrigin(0.5);

    this.headline = this.add.text(W / 2, 146, '', { fontFamily: UI_FONT, fontSize: '34px', color: COLORS.accentText }).setOrigin(0.5);

    this.add.text(W / 2 - 330, 230, String(p.correct), { fontFamily: NUMBER_FONT, fontSize: '80px', color: COLORS.accentText }).setOrigin(0.5);
    this.add.text(W / 2 - 330, 292, 'tus aciertos', { fontFamily: UI_FONT, fontSize: '20px', color: COLORS.muted }).setOrigin(0.5);
    this.add
      .text(W / 2 - 330, 340, `${p.waves} ${p.waves === 1 ? 'Pokémon derrotado' : 'Pokémon derrotados'}`, {
        fontFamily: UI_FONT,
        fontSize: '18px',
        color: COLORS.muted,
      })
      .setOrigin(0.5);

    this.scoreboard = new RoomScoreboard(this, W / 2 + 120, 300, { width: 460, rows: 8, fontSize: 22, title: 'Marcador de la sala' });

    this.waitingText = this.add.text(W / 2, 470, '', { fontFamily: UI_FONT, fontSize: '20px', color: COLORS.muted }).setOrigin(0.5);
    this.globalText = this.add.text(W / 2, 510, 'Guardando en el ranking…', { fontFamily: UI_FONT, fontSize: '20px', color: COLORS.muted }).setOrigin(0.5);

    const detail = () => this.scene.start('Result', p);
    const exit = () => {
      roomClient.leave();
      clearOnlineIntent();
      this.scene.start('Title');
    };
    new Button(this, W / 2 - 300, H - 70, 'Ver mis fallos', detail, { width: 280, height: 58, fontSize: '22px' });
    new Button(this, W / 2 + 300, H - 70, 'Salir de la sala', exit, { width: 280, height: 58, fontSize: '22px' });
    this.add
      .text(W / 2, H - 20, 'Enter: nueva ronda (anfitrión) · D: ver fallos · Escape: salir', { fontFamily: UI_FONT, fontSize: '16px', color: COLORS.muted })
      .setOrigin(0.5);

    bindWindowKeys(this, (e) => {
      if (e.repeat) return;
      if (e.key === 'Escape') exit();
      else if (e.key.toLowerCase() === 'd') detail();
      else if (e.key === 'Enter' && roomClient.isHost) this.again();
    });

    this.unsubscribe = roomClient.on((event) => this.onRoomEvent(event));
    this.render(roomClient.room);
    void this.submitGlobal();
  }

  private onRoomEvent(event: RoomEvent): void {
    if (event.type === 'room') {
      // El anfitrión pidió otra ronda: todos vuelven al lobby con la nueva semilla.
      if (event.room.state === 'lobby') {
        this.scene.start('Lobby', { name: this.params.name, trainer: this.params.trainer, rejoin: true });
        return;
      }
      this.render(event.room);
    } else if (event.type === 'closed') {
      this.waitingText.setText('Se cerró la conexión con la sala.').setColor(COLORS.danger);
      this.againButton?.destroy();
      this.againButton = null;
    }
  }

  private render(room: RoomView | null): void {
    this.scoreboard.render(room, roomClient.playerId);
    if (!room) {
      this.headline.setText('Partida terminada');
      return;
    }

    const pending = room.players.filter((p) => !p.finished).length;
    const place = roomClient.position;
    const leader = room.players[0];

    if (pending > 0) {
      this.headline.setText(place > 0 ? `Vas ${place}.º de ${room.players.length}` : 'Partida en curso');
      this.waitingText.setText(`Faltan ${pending} ${pending === 1 ? 'jugador' : 'jugadores'} por terminar…`).setColor(COLORS.muted);
    } else {
      const mine = roomClient.me;
      const won = Boolean(leader && mine && leader.id === mine.id);
      this.headline.setText(won ? '¡Ganaste la sala!' : leader ? `Ganó ${leader.name} con ${leader.correct}` : 'Partida terminada');
      this.waitingText.setText(place > 0 ? `Terminaste ${place}.º de ${room.players.length}` : '').setColor(COLORS.accentText);
    }

    if (roomClient.isHost && room.state !== 'playing' && !this.againButton) {
      this.againButton = new Button(this, W / 2, H - 70, 'Nueva ronda', () => this.again(), { width: 280, height: 58, fontSize: '22px' }).setFocused(true);
    }
  }

  private again(): void {
    if (!roomClient.isHost) return;
    roomClient.again();
  }

  private async submitGlobal(): Promise<void> {
    const p = this.params;
    const outcome = await scores.submit({ name: p.name, level: p.level, operation: p.operation, correct: p.correct, waves: p.waves });
    if (!this.alive) return;
    if (outcome.source === 'server') {
      this.globalText.setText(`Puesto #${outcome.position} en el ranking general de ${DIFFICULTY_LABELS[p.level].title}`).setColor(COLORS.accentText);
    } else {
      this.globalText.setText('Sin conexión con el ranking: guardado en este dispositivo').setColor(COLORS.danger);
    }
  }
}
