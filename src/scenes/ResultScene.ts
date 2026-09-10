import Phaser from 'phaser';
import { DIFFICULTY_LABELS } from '../config/difficulties';
import { audio } from '../systems/AudioManager';
import { summarizeFailures } from '../systems/BattleState';
import { scores } from '../systems/scores/ScoreService';
import type { BattleParams, ResultParams, SubmitOutcome } from '../types';
import { Button } from '../ui/Button';
import { bindWindowKeys } from '../ui/keys';
import { addMuteButton } from '../ui/MuteButton';
import { COLORS, H, NUMBER_FONT, UI_FONT, W } from '../ui/style';
import type { LeaderboardParams } from './LeaderboardScene';

const MAX_FAILURES_SHOWN = 5;

export class ResultScene extends Phaser.Scene {
  private params!: ResultParams;
  private outcome: SubmitOutcome | null = null;
  private status!: Phaser.GameObjects.Text;
  private alive = true;

  constructor() {
    super('Result');
  }

  init(data: ResultParams): void {
    this.params = data;
    this.outcome = null;
    this.alive = true;
  }

  create(): void {
    const p = this.params;
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.cameras.main.fadeIn(400);
    audio.playMusic('menu');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (this.alive = false));

    const opLabel = p.operation === 'dividir' ? 'División' : 'Multiplicación';
    this.add.text(W / 2, 55, 'Fin de la partida', { fontFamily: UI_FONT, fontSize: '52px', color: COLORS.text }).setOrigin(0.5);
    this.add
      .text(W / 2, 105, `${p.name} · ${DIFFICULTY_LABELS[p.level].title} · ${opLabel}`, { fontFamily: UI_FONT, fontSize: '22px', color: COLORS.muted })
      .setOrigin(0.5);

    this.stat(W / 2 - 220, 195, p.correct, 'aciertos');
    this.stat(W / 2 + 220, 195, p.waves, p.waves === 1 ? 'Pokémon derrotado' : 'Pokémon derrotados');

    if (p.defeated.length > 0) {
      const names = p.defeated.slice(0, 6).join(', ') + (p.defeated.length > 6 ? ` y ${p.defeated.length - 6} más` : '');
      this.add.text(W / 2, 280, names, { fontFamily: UI_FONT, fontSize: '20px', color: COLORS.accentText }).setOrigin(0.5);
    }

    this.status = this.add.text(W / 2, 315, 'Guardando puntuación…', { fontFamily: UI_FONT, fontSize: '20px', color: COLORS.muted }).setOrigin(0.5);

    this.buildFailures(360);

    const again = () => {
      const next: BattleParams = { level: p.level, operation: p.operation, name: p.name, trainer: p.trainer };
      this.scene.start('Battle', next);
    };
    const ranking = () => {
      const lp: LeaderboardParams = { level: p.level, operation: p.operation, name: p.name, trainer: p.trainer, highlight: this.outcome ?? undefined };
      this.scene.start('Leaderboard', lp);
    };
    const menu = () => this.scene.start('LevelSelect', { name: p.name, trainer: p.trainer });

    new Button(this, W / 2 - 300, H - 60, 'Jugar otra vez', again, { width: 260, height: 60, fontSize: '24px' }).setFocused(true);
    new Button(this, W / 2, H - 60, 'Ver ranking', ranking, { width: 260, height: 60, fontSize: '24px' });
    new Button(this, W / 2 + 300, H - 60, 'Cambiar nivel', menu, { width: 260, height: 60, fontSize: '24px' });
    this.add
      .text(W / 2, H - 18, 'Enter: otra vez · R: ranking · Escape: cambiar nivel', { fontFamily: UI_FONT, fontSize: '16px', color: COLORS.muted })
      .setOrigin(0.5);
    addMuteButton(this);

    bindWindowKeys(this, (e) => {
      if (e.repeat) return;
      if (e.key === 'Enter') again();
      else if (e.key === 'r' || e.key === 'R') ranking();
      else if (e.key === 'Escape') menu();
    });

    void this.submitScore();
  }

  private async submitScore(): Promise<void> {
    const p = this.params;
    const outcome = await scores.submit({ name: p.name, level: p.level, operation: p.operation, correct: p.correct, waves: p.waves });
    if (!this.alive) return;
    this.outcome = outcome;
    if (outcome.source === 'server') {
      this.status.setText(`Puesto #${outcome.position} en el ranking de ${DIFFICULTY_LABELS[p.level].title}`).setColor(COLORS.accentText);
    } else {
      this.status.setText(`Sin conexión: guardado en este dispositivo (puesto local #${outcome.position})`).setColor(COLORS.danger);
    }
  }

  private stat(x: number, y: number, value: number, label: string): void {
    this.add.text(x, y, String(value), { fontFamily: NUMBER_FONT, fontSize: '72px', color: COLORS.accentText }).setOrigin(0.5);
    this.add.text(x, y + 55, label, { fontFamily: UI_FONT, fontSize: '22px', color: COLORS.muted }).setOrigin(0.5);
  }

  private buildFailures(top: number): void {
    const failures = summarizeFailures(this.params.history);
    if (failures.length === 0) {
      this.add.text(W / 2, top + 30, 'Sin fallos. ¡Impecable!', { fontFamily: UI_FONT, fontSize: '26px', color: COLORS.accentText }).setOrigin(0.5);
      return;
    }

    this.add.text(W / 2, top, 'Operaciones que costaron más', { fontFamily: UI_FONT, fontSize: '24px', color: COLORS.text }).setOrigin(0.5);

    const shown = failures.slice(0, MAX_FAILURES_SHOWN);
    const rowH = 36;
    shown.forEach((f, i) => {
      const y = top + 40 + i * rowH;
      const detail: string[] = [];
      if (f.timeouts) detail.push(`${f.timeouts} sin tiempo`);
      if (f.misses) detail.push(`${f.misses} ${f.misses === 1 ? 'fallo' : 'fallos'}`);
      this.add
        .text(W / 2 - 40, y, `${f.problem.text} = ${f.problem.answer}`, { fontFamily: NUMBER_FONT, fontSize: '26px', color: COLORS.text })
        .setOrigin(1, 0.5);
      this.add.text(W / 2, y, detail.join(' · '), { fontFamily: UI_FONT, fontSize: '19px', color: f.solved ? COLORS.muted : COLORS.danger }).setOrigin(0, 0.5);
    });

    if (failures.length > shown.length) {
      this.add
        .text(W / 2, top + 40 + shown.length * rowH, `y ${failures.length - shown.length} más`, { fontFamily: UI_FONT, fontSize: '18px', color: COLORS.muted })
        .setOrigin(0.5);
    }
  }
}
