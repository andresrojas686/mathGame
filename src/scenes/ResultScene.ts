import Phaser from 'phaser';
import { DIFFICULTY_LABELS } from '../config/difficulties';
import { summarizeFailures } from '../systems/BattleState';
import type { BattleParams, ResultParams } from '../types';
import { Button } from '../ui/Button';
import { bindWindowKeys } from '../ui/keys';
import { COLORS, H, NUMBER_FONT, UI_FONT, W } from '../ui/style';

const MAX_FAILURES_SHOWN = 6;

export class ResultScene extends Phaser.Scene {
  private params!: ResultParams;

  constructor() {
    super('Result');
  }

  init(data: ResultParams): void {
    this.params = data;
  }

  create(): void {
    const p = this.params;
    this.cameras.main.setBackgroundColor(COLORS.bg);

    this.add
      .text(W / 2, 70, 'Fin de la partida', { fontFamily: UI_FONT, fontSize: '56px', color: COLORS.text })
      .setOrigin(0.5);
    this.add
      .text(W / 2, 125, `${p.name} · ${DIFFICULTY_LABELS[p.level].title}`, { fontFamily: UI_FONT, fontSize: '24px', color: COLORS.muted })
      .setOrigin(0.5);

    this.stat(W / 2 - 220, 230, p.correct, 'aciertos');
    this.stat(W / 2 + 220, 230, p.waves, p.waves === 1 ? 'monstruo derrotado' : 'monstruos derrotados');

    this.buildFailures(330);

    const again = () => {
      const next: BattleParams = { level: p.level, name: p.name };
      this.scene.start('Battle', next);
    };
    const menu = () => this.scene.start('LevelSelect', { name: p.name });
    new Button(this, W / 2 - 180, H - 80, 'Jugar otra vez', again).setFocused(true);
    new Button(this, W / 2 + 180, H - 80, 'Cambiar nivel', menu);
    this.add
      .text(W / 2, H - 28, 'Enter: otra vez · Escape: cambiar nivel', { fontFamily: UI_FONT, fontSize: '16px', color: COLORS.muted })
      .setOrigin(0.5);

    bindWindowKeys(this, (e) => {
      if (e.repeat) return;
      if (e.key === 'Enter') again();
      else if (e.key === 'Escape') menu();
    });
  }

  private stat(x: number, y: number, value: number, label: string): void {
    this.add.text(x, y, String(value), { fontFamily: NUMBER_FONT, fontSize: '80px', color: COLORS.accentText }).setOrigin(0.5);
    this.add.text(x, y + 60, label, { fontFamily: UI_FONT, fontSize: '22px', color: COLORS.muted }).setOrigin(0.5);
  }

  private buildFailures(top: number): void {
    const failures = summarizeFailures(this.params.history);
    if (failures.length === 0) {
      this.add
        .text(W / 2, top + 40, 'Sin fallos. ¡Impecable!', { fontFamily: UI_FONT, fontSize: '26px', color: COLORS.accentText })
        .setOrigin(0.5);
      return;
    }

    this.add
      .text(W / 2, top, 'Operaciones que costaron más', { fontFamily: UI_FONT, fontSize: '24px', color: COLORS.text })
      .setOrigin(0.5);

    const shown = failures.slice(0, MAX_FAILURES_SHOWN);
    const rowH = 38;
    shown.forEach((f, i) => {
      const y = top + 45 + i * rowH;
      const detail: string[] = [];
      if (f.timeouts) detail.push(`${f.timeouts} sin tiempo`);
      if (f.misses) detail.push(`${f.misses} ${f.misses === 1 ? 'fallo' : 'fallos'}`);
      this.add
        .text(W / 2 - 40, y, `${f.problem.text} = ${f.problem.answer}`, { fontFamily: NUMBER_FONT, fontSize: '28px', color: COLORS.text })
        .setOrigin(1, 0.5);
      this.add
        .text(W / 2 + 0, y, detail.join(' · '), { fontFamily: UI_FONT, fontSize: '20px', color: f.solved ? COLORS.muted : COLORS.danger })
        .setOrigin(0, 0.5);
    });

    if (failures.length > shown.length) {
      this.add
        .text(W / 2, top + 45 + shown.length * rowH, `y ${failures.length - shown.length} más`, {
          fontFamily: UI_FONT,
          fontSize: '18px',
          color: COLORS.muted,
        })
        .setOrigin(0.5);
    }
  }
}
