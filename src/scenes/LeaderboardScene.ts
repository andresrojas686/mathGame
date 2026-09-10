import Phaser from 'phaser';
import { DIFFICULTY_IDS, DIFFICULTY_LABELS } from '../config/difficulties';
import { audio } from '../systems/AudioManager';
import { scores } from '../systems/scores/ScoreService';
import { boardKey, type DifficultyId, type LeaderboardData, type Operation, type ScoreSource, type SubmitOutcome } from '../types';
import { Button } from '../ui/Button';
import { bindWindowKeys } from '../ui/keys';
import { addMuteButton } from '../ui/MuteButton';
import { COLORS, H, NUMBER_FONT, UI_FONT, W } from '../ui/style';

export interface LeaderboardParams {
  level?: DifficultyId;
  operation?: Operation;
  name?: string;
  trainer?: string;
  /** Partida recién jugada, para resaltarla. */
  highlight?: SubmitOutcome;
}

const ROW_H = 38;
const TOP = 230;
const OPERATIONS: { id: Operation; label: string }[] = [
  { id: 'multiplicar', label: '× Multiplicar' },
  { id: 'dividir', label: '÷ Dividir' },
];

export class LeaderboardScene extends Phaser.Scene {
  private params: LeaderboardParams = {};
  private tab = 0;
  private operation: Operation = 'multiplicar';
  private board: LeaderboardData | null = null;
  private source: ScoreSource = 'server';
  private tabTexts: Phaser.GameObjects.Text[] = [];
  private opTexts: Phaser.GameObjects.Text[] = [];
  private rows: Phaser.GameObjects.GameObject[] = [];
  private notice!: Phaser.GameObjects.Text;
  private alive = true;

  constructor() {
    super('Leaderboard');
  }

  init(data: LeaderboardParams): void {
    this.params = data ?? {};
    this.operation = data?.operation ?? 'multiplicar';
    this.tab = Math.max(0, DIFFICULTY_IDS.indexOf(data?.level ?? 'facil'));
    this.tabTexts = [];
    this.opTexts = [];
    this.rows = [];
    this.board = null;
    this.alive = true;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    audio.playMusic('menu');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (this.alive = false));

    this.add.text(W / 2, 50, 'Ranking', { fontFamily: UI_FONT, fontSize: '52px', color: COLORS.text }).setOrigin(0.5);
    this.notice = this.add.text(W / 2, 96, '', { fontFamily: UI_FONT, fontSize: '18px', color: COLORS.danger }).setOrigin(0.5);

    OPERATIONS.forEach((op, i) => {
      const t = this.add
        .text(W / 2 + (i - 0.5) * 260, 135, op.label, { fontFamily: UI_FONT, fontSize: '24px', color: COLORS.muted })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.setOperation(op.id));
      this.opTexts.push(t);
    });
    DIFFICULTY_IDS.forEach((id, i) => {
      const t = this.add
        .text(W / 2 + (i - 1) * 220, 180, DIFFICULTY_LABELS[id].title, { fontFamily: UI_FONT, fontSize: '28px', color: COLORS.muted })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.setTab(i));
      this.tabTexts.push(t);
    });

    const canPlay = Boolean(this.params.name && this.params.trainer);
    const play = () => {
      if (canPlay) this.scene.start('LevelSelect', { name: this.params.name, trainer: this.params.trainer });
      else this.scene.start('Name');
    };
    const menu = () => this.scene.start('Title');
    new Button(this, W / 2 - 180, H - 56, canPlay ? 'Elegir nivel' : 'Jugar', play, { height: 56 }).setFocused(true);
    new Button(this, W / 2 + 180, H - 56, 'Menú', menu, { height: 56 });
    this.add
      .text(W / 2, H - 16, '← → nivel · M / D operación · Enter jugar · Escape menú', { fontFamily: UI_FONT, fontSize: '15px', color: COLORS.muted })
      .setOrigin(0.5, 1);
    addMuteButton(this);

    bindWindowKeys(this, (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (e.key === 'ArrowLeft') this.setTab((this.tab + 2) % 3);
      else if (e.key === 'ArrowRight') this.setTab((this.tab + 1) % 3);
      else if (k === 'm') this.setOperation('multiplicar');
      else if (k === 'd') this.setOperation('dividir');
      else if (e.key === 'Enter') play();
      else if (e.key === 'Escape') menu();
    });

    this.renderTabs();
    this.renderRows();
    void this.fetch();
  }

  private async fetch(): Promise<void> {
    const result = await scores.leaderboard();
    if (!this.alive) return;
    this.board = result.data;
    this.source = result.source;
    this.notice.setText(this.source === 'local' ? 'Sin conexión con el servidor: mostrando el ranking de este dispositivo' : '');
    this.renderRows();
  }

  private setTab(i: number): void {
    this.tab = i;
    this.renderTabs();
    this.renderRows();
  }

  private setOperation(op: Operation): void {
    this.operation = op;
    this.renderTabs();
    this.renderRows();
  }

  private renderTabs(): void {
    this.tabTexts.forEach((t, i) => t.setColor(i === this.tab ? COLORS.accentText : COLORS.muted).setFontStyle(i === this.tab ? 'bold' : 'normal'));
    this.opTexts.forEach((t, i) => {
      const active = OPERATIONS[i]?.id === this.operation;
      t.setColor(active ? COLORS.accentText : COLORS.muted).setFontStyle(active ? 'bold' : 'normal');
    });
  }

  private renderRows(): void {
    this.rows.forEach((r) => r.destroy());
    this.rows = [];
    const level = DIFFICULTY_IDS[this.tab]!;
    const key = boardKey(this.operation, level);

    if (!this.board) {
      this.rows.push(this.add.text(W / 2, TOP + 60, 'Cargando…', { fontFamily: UI_FONT, fontSize: '24px', color: COLORS.muted }).setOrigin(0.5));
      return;
    }
    const list = this.board.boards[key] ?? [];
    const hl = this.params.highlight;
    const isHighlight = (e: { name: string; date: string }) => hl?.board === key && hl.entry.name === e.name && hl.entry.date === e.date;

    if (list.length === 0) {
      this.rows.push(
        this.add.text(W / 2, TOP + 60, 'Todavía no hay partidas en esta tabla. ¡Sé la primera!', { fontFamily: UI_FONT, fontSize: '22px', color: COLORS.muted }).setOrigin(0.5),
      );
    }

    const header = this.add.text(W / 2 - 300, TOP - 10, '#      nombre                        aciertos    Pokémon', {
      fontFamily: NUMBER_FONT,
      fontSize: '17px',
      color: COLORS.muted,
    });
    this.rows.push(header);

    list.slice(0, 10).forEach((e, i) => this.rows.push(...this.row(TOP + 22 + i * ROW_H, i + 1, e.name, e.correct, e.waves, isHighlight(e))));

    if (hl && hl.board === key && !list.slice(0, 10).some(isHighlight)) {
      const y = TOP + 22 + Math.min(list.length, 10) * ROW_H + 10;
      this.rows.push(this.add.text(W / 2, y - 8, '…', { fontFamily: NUMBER_FONT, fontSize: '20px', color: COLORS.muted }).setOrigin(0.5, 0));
      this.rows.push(...this.row(y + 18, hl.position, hl.entry.name, hl.entry.correct, hl.entry.waves, true));
    }
  }

  private row(y: number, pos: number, name: string, correct: number, waves: number, highlight: boolean): Phaser.GameObjects.GameObject[] {
    const color = highlight ? COLORS.accentText : COLORS.text;
    const out: Phaser.GameObjects.GameObject[] = [];
    if (highlight) out.push(this.add.rectangle(W / 2, y + 12, 640, ROW_H - 4, COLORS.fieldActive).setStrokeStyle(2, COLORS.accent));
    const style = { fontFamily: NUMBER_FONT, fontSize: '23px', color };
    out.push(this.add.text(W / 2 - 300, y, `#${pos}`, style));
    out.push(this.add.text(W / 2 - 220, y, name, { ...style, fontFamily: UI_FONT }));
    out.push(this.add.text(W / 2 + 150, y, String(correct), style).setOrigin(1, 0));
    out.push(this.add.text(W / 2 + 300, y, String(waves), style).setOrigin(1, 0));
    return out;
  }
}
