import Phaser from 'phaser';
import type { RoomView } from '../systems/online/protocol';
import { COLORS, UI_FONT } from './style';

export interface ScoreboardOptions {
  width?: number;
  rows?: number;
  fontSize?: number;
  title?: string;
  /** Color del texto normal, para adaptarse a la paleta del gimnasio. */
  textColor?: string;
  mutedColor?: string;
  accentColor?: string;
  background?: number;
}

interface Row {
  place: Phaser.GameObjects.Text;
  name: Phaser.GameObjects.Text;
  score: Phaser.GameObjects.Text;
}

/**
 * Lista de jugadores de la sala, ordenada por aciertos. Las filas se crean una vez y
 * solo se cambia el texto: durante el combate esto se refresca varias veces por segundo.
 */
export class RoomScoreboard extends Phaser.GameObjects.Container {
  private readonly rows: Row[] = [];
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly footer: Phaser.GameObjects.Text;
  private readonly opts: Required<ScoreboardOptions>;

  constructor(scene: Phaser.Scene, x: number, y: number, options: ScoreboardOptions = {}) {
    super(scene, x, y);
    this.opts = {
      width: options.width ?? 300,
      rows: options.rows ?? 6,
      fontSize: options.fontSize ?? 20,
      title: options.title ?? 'Sala',
      textColor: options.textColor ?? COLORS.text,
      mutedColor: options.mutedColor ?? COLORS.muted,
      accentColor: options.accentColor ?? COLORS.accentText,
      background: options.background ?? COLORS.bg,
    };

    const { width, rows, fontSize } = this.opts;
    const lineH = fontSize + 12;
    const height = 54 + rows * lineH + 26;
    const box = scene.add.rectangle(0, 0, width, height, this.opts.background, 0.72).setStrokeStyle(2, COLORS.fieldBorder, 0.8);
    this.add(box);

    const top = -height / 2;
    this.titleText = scene.add
      .text(0, top + 22, this.opts.title, { fontFamily: UI_FONT, fontSize: `${fontSize}px`, color: this.opts.accentColor })
      .setOrigin(0.5);
    this.add(this.titleText);

    const left = -width / 2 + 16;
    const right = width / 2 - 16;
    for (let i = 0; i < rows; i++) {
      const rowY = top + 54 + i * lineH + lineH / 2;
      const place = scene.add.text(left, rowY, '', { fontFamily: UI_FONT, fontSize: `${fontSize - 2}px`, color: this.opts.mutedColor }).setOrigin(0, 0.5);
      const name = scene.add.text(left + 30, rowY, '', { fontFamily: UI_FONT, fontSize: `${fontSize}px`, color: this.opts.textColor }).setOrigin(0, 0.5);
      const score = scene.add.text(right, rowY, '', { fontFamily: UI_FONT, fontSize: `${fontSize}px`, color: this.opts.textColor }).setOrigin(1, 0.5);
      this.rows.push({ place, name, score });
      this.add([place, name, score]);
    }

    this.footer = scene.add
      .text(0, top + height - 18, '', { fontFamily: UI_FONT, fontSize: `${fontSize - 4}px`, color: this.opts.mutedColor })
      .setOrigin(0.5);
    this.add(this.footer);

    scene.add.existing(this);
  }

  setTitle(text: string): this {
    this.titleText.setText(text);
    return this;
  }

  /**
   * Pinta las primeras posiciones y, si el jugador no entra en ellas, usa la última
   * fila para su propia posición: en una sala de 50 lo único que no puede faltar es uno mismo.
   */
  render(room: RoomView | null, meId: string | null): this {
    const players = room?.players ?? [];
    const myIndex = players.findIndex((p) => p.id === meId);
    const visible = this.rows.length;
    const showMine = myIndex >= visible;
    const slots = showMine ? visible - 1 : visible;

    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i]!;
      const isMineSlot = showMine && i === this.rows.length - 1;
      const index = isMineSlot ? myIndex : i;
      const player = index < slots || isMineSlot ? players[index] : undefined;
      if (!player) {
        row.place.setText('');
        row.name.setText('');
        row.score.setText('');
        continue;
      }
      const mine = player.id === meId;
      const color = mine ? this.opts.accentColor : this.opts.textColor;
      const suffix = player.finished ? ' ✓' : player.connected ? '' : ' ·';
      row.place.setText(`${index + 1}.`).setColor(mine ? this.opts.accentColor : this.opts.mutedColor);
      row.name.setText(trim(player.name) + suffix).setColor(color);
      row.score.setText(String(player.correct)).setColor(color);
    }

    const total = players.length;
    const hidden = Math.max(0, total - (showMine ? slots + 1 : Math.min(total, slots)));
    this.footer.setText(hidden > 0 ? `y ${hidden} más · ${total} jugadores` : `${total} ${total === 1 ? 'jugador' : 'jugadores'}`);
    return this;
  }
}

function trim(name: string): string {
  return name.length > 12 ? `${name.slice(0, 11)}…` : name;
}
