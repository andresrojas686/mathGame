import Phaser from 'phaser';
import { DIFFICULTY_LABELS } from '../config/difficulties';
import { DEFAULT_TRAINER_ID } from '../config/trainers';
import { audio } from '../systems/AudioManager';
import type { RoomView } from '../systems/online/protocol';
import { MAX_ROOM_PLAYERS } from '../systems/online/protocol';
import { roomClient, type RoomEvent } from '../systems/online/RoomClient';
import { clearOnlineIntent, copyText, forgetRoomInUrl, getOnlineIntent, roomLink } from '../systems/online/session';
import type { BattleParams, DifficultyId, Operation } from '../types';
import { Button } from '../ui/Button';
import { bindWindowKeys } from '../ui/keys';
import { addMuteButton } from '../ui/MuteButton';
import { COLORS, H, NUMBER_FONT, UI_FONT, W } from '../ui/style';

export interface LobbyParams {
  name: string;
  trainer: string;
  level?: DifficultyId;
  operation?: Operation;
  /** Vuelta al lobby desde el resultado: ya hay sala y socket, no hay que crear nada. */
  rejoin?: boolean;
}

/** Columnas de la lista de jugadores. Con 50 caben 25 por columna. */
const LIST_COLUMNS = 2;
const LIST_ROWS = 14;
const LIST_SLOTS = LIST_COLUMNS * LIST_ROWS;

export class LobbyScene extends Phaser.Scene {
  private params!: LobbyParams;
  private unsubscribe: (() => void) | null = null;
  private codeText!: Phaser.GameObjects.Text;
  private linkText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private slots: Phaser.GameObjects.Text[] = [];
  private moreText!: Phaser.GameObjects.Text;
  private startButton: Button | null = null;
  private countdownText!: Phaser.GameObjects.Text;
  private launching = false;

  constructor() {
    super('Lobby');
  }

  init(data: LobbyParams): void {
    this.params = { ...data, name: data.name || 'Jugador', trainer: data.trainer || DEFAULT_TRAINER_ID };
    this.slots = [];
    this.startButton = null;
    this.launching = false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    audio.playMusic('menu');
    addMuteButton(this);

    this.add.text(W / 2, 48, 'Sala de juego', { fontFamily: UI_FONT, fontSize: '44px', color: COLORS.text }).setOrigin(0.5);
    this.codeText = this.add.text(W / 2, 120, '·····', { fontFamily: NUMBER_FONT, fontSize: '72px', color: COLORS.accentText }).setOrigin(0.5);
    this.linkText = this.add.text(W / 2, 178, 'Conectando…', { fontFamily: UI_FONT, fontSize: '20px', color: COLORS.muted }).setOrigin(0.5);
    this.infoText = this.add.text(W / 2, 212, '', { fontFamily: UI_FONT, fontSize: '20px', color: COLORS.text }).setOrigin(0.5);

    this.buildPlayerList(260);

    this.statusText = this.add.text(W / 2, H - 150, 'Conectando con el servidor…', { fontFamily: UI_FONT, fontSize: '22px', color: COLORS.muted }).setOrigin(0.5);
    this.countdownText = this.add
      .text(W / 2, H / 2, '', { fontFamily: NUMBER_FONT, fontSize: '160px', color: COLORS.accentText })
      .setOrigin(0.5)
      .setDepth(100)
      .setVisible(false);

    new Button(this, W / 2 - 330, H - 70, 'Copiar enlace', () => void this.copyLink(), { width: 280, height: 58, fontSize: '22px' });
    new Button(this, W / 2 + 330, H - 70, 'Salir', () => this.exit(), { width: 280, height: 58, fontSize: '22px' });

    this.add
      .text(W / 2, H - 22, 'Comparte el código o el enlace · C copia el enlace · Escape sale', { fontFamily: UI_FONT, fontSize: '17px', color: COLORS.muted })
      .setOrigin(0.5);

    bindWindowKeys(this, (e) => {
      if (e.repeat) return;
      if (e.key === 'Escape') this.exit();
      else if (e.key.toLowerCase() === 'c') void this.copyLink();
      else if (e.key === 'Enter' && roomClient.isHost) this.startGame();
    });

    this.unsubscribe = roomClient.on((event) => this.onRoomEvent(event));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.unsubscribe = null;
    });

    void this.enterRoom();
  }

  // ---------- conexión ----------

  private async enterRoom(): Promise<void> {
    const intent = getOnlineIntent();
    try {
      if (this.params.rejoin) {
        if (roomClient.room) this.render(roomClient.room);
        else this.fail('la sala ya no está disponible');
      }
      else if (intent?.mode === 'join') await roomClient.join(intent.code, { name: this.params.name, trainer: this.params.trainer });
      else
        await roomClient.create({
          name: this.params.name,
          trainer: this.params.trainer,
          level: this.params.level ?? 'facil',
          operation: this.params.operation ?? 'multiplicar',
        });
    } catch (err) {
      this.fail(err instanceof Error ? err.message : 'no se pudo conectar');
    }
  }

  private onRoomEvent(event: RoomEvent): void {
    switch (event.type) {
      case 'room':
        this.render(event.room);
        break;
      case 'started':
        this.launch(event.room, event.countdownMs);
        break;
      case 'error':
        this.fail(event.error.message);
        break;
      case 'closed':
        if (!this.launching) this.fail('se perdió la conexión con el servidor');
        break;
    }
  }

  // ---------- pintado ----------

  private buildPlayerList(top: number): void {
    this.add.text(W / 2, top, 'Jugadores', { fontFamily: UI_FONT, fontSize: '24px', color: COLORS.text }).setOrigin(0.5);
    const colW = 420;
    const startX = W / 2 - ((LIST_COLUMNS - 1) * colW) / 2;
    for (let i = 0; i < LIST_SLOTS; i++) {
      const col = Math.floor(i / LIST_ROWS);
      const row = i % LIST_ROWS;
      const text = this.add
        .text(startX + col * colW, top + 40 + row * 24, '', { fontFamily: UI_FONT, fontSize: '19px', color: COLORS.text })
        .setOrigin(0.5);
      this.slots.push(text);
    }
    this.moreText = this.add.text(W / 2, top + 40 + LIST_ROWS * 24, '', { fontFamily: UI_FONT, fontSize: '18px', color: COLORS.muted }).setOrigin(0.5);
  }

  private render(room: RoomView): void {
    this.codeText.setText(room.code);
    this.linkText.setText(roomLink(room.code));
    const label = DIFFICULTY_LABELS[room.level].title;
    const op = room.operation === 'dividir' ? 'División' : 'Multiplicación';
    this.infoText.setText(`${op} · ${label} · hasta ${MAX_ROOM_PLAYERS} jugadores`);

    const visible = room.players.slice(0, LIST_SLOTS);
    this.slots.forEach((slot, i) => {
      const player = visible[i];
      if (!player) {
        slot.setText('');
        return;
      }
      const mine = player.id === roomClient.playerId;
      const marks = [player.id === room.hostId ? '★' : '', mine ? '(tú)' : ''].filter(Boolean).join(' ');
      slot.setText(`${player.name}${marks ? ` ${marks}` : ''}`).setColor(mine ? COLORS.accentText : COLORS.text);
    });
    const hidden = room.players.length - visible.length;
    this.moreText.setText(hidden > 0 ? `y ${hidden} más` : '');

    if (roomClient.isHost) {
      const alone = room.players.length < 2;
      this.statusText.setText(alone ? 'Comparte el enlace. Puedes empezar en cuanto llegue alguien.' : `Listos ${room.players.length} jugadores.`);
      if (!this.startButton) this.startButton = new Button(this, W / 2, H - 70, 'Empezar partida', () => this.startGame(), { width: 320, height: 58, fontSize: '24px' });
      this.startButton.setFocused(!alone);
    } else {
      this.statusText.setText('Esperando a que el anfitrión empiece la partida…');
      this.startButton?.destroy();
      this.startButton = null;
    }
  }

  // ---------- acciones ----------

  private startGame(): void {
    if (!roomClient.isHost || this.launching) return;
    this.statusText.setText('Empezando…');
    roomClient.start();
  }

  private async copyLink(): Promise<void> {
    const room = roomClient.room;
    if (!room) return;
    const ok = await copyText(roomLink(room.code));
    this.statusText.setText(ok ? 'Enlace copiado. Pégalo donde quieras.' : 'No se pudo copiar: selecciona el enlace a mano.');
  }

  private launch(room: RoomView, countdownMs: number): void {
    if (this.launching) return;
    this.launching = true;
    clearOnlineIntent();
    forgetRoomInUrl();
    this.startButton?.destroy();
    this.startButton = null;
    this.statusText.setText('¡A jugar!');

    let left = Math.max(1, Math.round(countdownMs / 1000));
    this.countdownText.setText(String(left)).setVisible(true);
    this.time.addEvent({
      delay: 1000,
      repeat: left - 1,
      callback: () => {
        left -= 1;
        if (left > 0) {
          this.countdownText.setText(String(left));
          return;
        }
        const params: BattleParams & { online: { seed: number; code: string } } = {
          level: room.level,
          operation: room.operation,
          name: this.params.name,
          trainer: this.params.trainer,
          online: { seed: room.seed, code: room.code },
        };
        this.scene.start('Battle', params);
      },
    });
  }

  private fail(message: string): void {
    this.statusText.setText(message).setColor(COLORS.danger);
    this.startButton?.destroy();
    this.startButton = null;
  }

  private exit(): void {
    roomClient.leave();
    clearOnlineIntent();
    forgetRoomInUrl();
    this.scene.start('Title');
  }
}
