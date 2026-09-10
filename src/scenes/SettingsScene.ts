import Phaser from 'phaser';
import { CUSTOM_MISS_ID, FEEDBACK_CATALOG, MISS_MAX_LENGTH, type MusicThemeId } from '../config/feedback';
import { DIFFICULTY_LABELS } from '../config/difficulties';
import { audio } from '../systems/AudioManager';
import { missTextFor, sanitizeMissText } from '../systems/FeedbackSettings';
import { MissLabel } from '../ui/MissLabel';
import { bindWindowKeys } from '../ui/keys';
import { COLORS, H, UI_FONT, W, prefersReducedMotion } from '../ui/style';

export interface SettingsParams {
  /** Abierto sobre el combate en pausa: se cierra con scene.stop y avisa por game.events. */
  overlay?: boolean;
  returnTo?: string;
}

export const SETTINGS_CLOSED_EVENT = 'settings-closed';

const PANEL_W = 1000;
const PANEL_H = 640;
const LEFT = W / 2 - PANEL_W / 2 + 40;
const TOP = H / 2 - PANEL_H / 2;

/**
 * Ajustes (plan.md §9): volúmenes, sonido de acierto, texto de fallo (incluido personalizado)
 * y música de cada mundo, con botón de prueba para cada uno. Los cambios se aplican al instante.
 */
export class SettingsScene extends Phaser.Scene {
  private params: SettingsParams = {};
  private radios: { id: string; text: Phaser.GameObjects.Text; group: string }[] = [];
  private musicTexts: Partial<Record<MusicThemeId, Phaser.GameObjects.Text>> = {};
  private volumeBars: { key: 'musicVolume' | 'sfxVolume'; fill: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }[] = [];
  private muteText!: Phaser.GameObjects.Text;
  private customInput!: HTMLInputElement;
  private missPreview!: MissLabel;

  constructor() {
    super('Settings');
  }

  init(data: SettingsParams): void {
    this.params = data ?? {};
    this.radios = [];
    this.musicTexts = {};
    this.volumeBars = [];
  }

  create(): void {
    if (this.params.overlay) this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6);
    else this.cameras.main.setBackgroundColor(COLORS.bg);

    this.add.rectangle(W / 2, H / 2, PANEL_W, PANEL_H, COLORS.bg, 0.98).setStrokeStyle(3, COLORS.accent);
    this.add.text(LEFT, TOP + 24, 'Ajustes', { fontFamily: UI_FONT, fontSize: '40px', color: COLORS.text });
    this.add
      .text(W / 2 + PANEL_W / 2 - 40, TOP + 30, '✕', { fontFamily: UI_FONT, fontSize: '36px', color: COLORS.muted })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.close());

    this.volumeRow(TOP + 100, 'Música', 'musicVolume');
    this.volumeRow(TOP + 150, 'Efectos', 'sfxVolume');
    this.muteText = this.add
      .text(LEFT + 620, TOP + 100, '', { fontFamily: UI_FONT, fontSize: '22px', color: COLORS.text })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => audio.toggleMute());

    this.sectionTitle(TOP + 210, 'Al acertar');
    this.radioRow(TOP + 245, 'correct', FEEDBACK_CATALOG.correct.map((c) => ({ id: c.id, label: c.label })), (id) => {
      audio.updateSettings({ correctId: id });
      audio.previewCorrect(id);
    });
    this.testButton(LEFT + 800,TOP + 245, () => audio.previewCorrect(audio.settings.correctId));

    this.sectionTitle(TOP + 300, 'Al equivocarse');
    this.radioRow(TOP + 335, 'miss', [...FEEDBACK_CATALOG.miss.map((m) => ({ id: m.id, label: m.text })), { id: CUSTOM_MISS_ID, label: 'Otro:' }], (id) => {
      if (id === CUSTOM_MISS_ID) this.applyCustom();
      else audio.updateSettings({ missId: id });
      this.missPreview.setText(missTextFor(audio.settings));
    });
    this.buildCustomInput(LEFT + 600, TOP + 347);
    this.testButton(LEFT + 800,TOP + 335, () => {
      this.missPreview.setText(missTextFor(audio.settings));
      this.missPreview.show();
    });
    this.missPreview = new MissLabel(this, LEFT + 730, TOP + 400, missTextFor(audio.settings), COLORS.miss, prefersReducedMotion());

    this.sectionTitle(TOP + 410, 'Música de cada mundo');
    const themes: { id: MusicThemeId; label: string }[] = [
      { id: 'facil', label: DIFFICULTY_LABELS.facil.title },
      { id: 'normal', label: DIFFICULTY_LABELS.normal.title },
      { id: 'dificil', label: DIFFICULTY_LABELS.dificil.title },
      { id: 'menu', label: 'Menú' },
    ];
    themes.forEach((t, i) => this.musicRow(TOP + 445 + i * 38, t.id, t.label));

    this.add
      .text(W / 2, TOP + PANEL_H - 22, 'Escape para cerrar · M silencia', { fontFamily: UI_FONT, fontSize: '16px', color: COLORS.muted })
      .setOrigin(0.5, 1);

    bindWindowKeys(this, (e) => {
      if (e.repeat) return;
      if (e.key === 'Escape') this.close();
      else if ((e.key === 'm' || e.key === 'M') && document.activeElement !== this.customInput) audio.toggleMute();
    });

    const refresh = () => this.refresh();
    window.addEventListener('multiplicon:audio-changed', refresh);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('multiplicon:audio-changed', refresh);
      audio.stopPreview();
    });
    this.refresh();
  }

  // ---------- filas ----------

  private sectionTitle(y: number, text: string): void {
    this.add.text(LEFT, y, text, { fontFamily: UI_FONT, fontSize: '22px', color: COLORS.accentText });
  }

  private volumeRow(y: number, label: string, key: 'musicVolume' | 'sfxVolume'): void {
    this.add.text(LEFT, y, label, { fontFamily: UI_FONT, fontSize: '24px', color: COLORS.text });
    const barX = LEFT + 200;
    const barW = 260;
    const step = (d: number) => audio.updateSettings({ [key]: Math.round(Math.min(1, Math.max(0, audio.settings[key] + d)) * 10) / 10 });
    this.smallButton(barX - 30, y + 14, '−', () => step(-0.1));
    this.add.rectangle(barX + barW / 2, y + 14, barW, 16, COLORS.timerTrack);
    const fill = this.add.rectangle(barX, y + 14, barW, 16, COLORS.accent).setOrigin(0, 0.5);
    this.add
      .rectangle(barX + barW / 2, y + 14, barW, 36, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (p: Phaser.Input.Pointer) => audio.updateSettings({ [key]: Math.round(((p.x - barX) / barW) * 10) / 10 }));
    this.smallButton(barX + barW + 30, y + 14, '+', () => step(0.1));
    const value = this.add.text(barX + barW + 60, y, '', { fontFamily: UI_FONT, fontSize: '22px', color: COLORS.muted });
    this.volumeBars.push({ key, fill, label: value });
  }

  private radioRow(y: number, group: string, options: { id: string; label: string }[], onSelect: (id: string) => void): void {
    let x = LEFT;
    for (const o of options) {
      const t = this.add
        .text(x, y, `( ) ${o.label}`, { fontFamily: UI_FONT, fontSize: '20px', color: COLORS.text })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => onSelect(o.id));
      this.radios.push({ id: o.id, text: t, group });
      x += t.width + 28;
    }
  }

  private musicRow(y: number, theme: MusicThemeId, label: string): void {
    this.add.text(LEFT, y, label, { fontFamily: UI_FONT, fontSize: '20px', color: COLORS.text });
    const options = FEEDBACK_CATALOG.music[theme];
    const cycle = (d: number) => {
      const i = options.findIndex((o) => o.id === audio.settings.musicByTheme[theme]);
      const next = options[(i + d + options.length) % options.length]!;
      audio.updateSettings({ musicByTheme: { ...audio.settings.musicByTheme, [theme]: next.id } });
    };
    this.smallButton(LEFT + 240, y + 13, '◀', () => cycle(-1));
    this.musicTexts[theme] = this.add.text(LEFT + 400, y, '', { fontFamily: UI_FONT, fontSize: '20px', color: COLORS.accentText }).setOrigin(0.5, 0);
    this.smallButton(LEFT + 560, y + 13, '▶', () => cycle(1));
    this.testButton(LEFT + 640, y, () => audio.previewMusic(theme, audio.settings.musicByTheme[theme]), 'Probar 8 s');
  }

  private buildCustomInput(x: number, y: number): void {
    const dom = this.add.dom(x + 90, y, 'input', {
      width: '180px',
      height: '32px',
      boxSizing: 'border-box',
      padding: '0 8px',
      fontFamily: UI_FONT,
      fontSize: '18px',
      color: COLORS.text,
      background: '#2c2c3c',
      border: '2px solid #8a8a9a',
      borderRadius: '4px',
      outline: 'none',
      textTransform: 'uppercase',
    });
    this.customInput = dom.node as HTMLInputElement;
    this.customInput.type = 'text';
    this.customInput.maxLength = MISS_MAX_LENGTH;
    this.customInput.placeholder = `máx. ${MISS_MAX_LENGTH}`;
    this.customInput.setAttribute('aria-label', 'Texto personalizado al equivocarse');
    this.customInput.value = audio.settings.missCustomText ?? '';
    this.customInput.addEventListener('input', () => this.applyCustom());
    // Las teclas siguen llegando a la ventana (Escape cierra); el atajo M se ignora mientras se escribe.
    this.customInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') this.customInput.blur();
    });
  }

  /** Texto vacío: se cae al valor por defecto (validateSettings lo garantiza). */
  private applyCustom(): void {
    const text = sanitizeMissText(this.customInput.value);
    audio.updateSettings(text ? { missId: CUSTOM_MISS_ID, missCustomText: text } : { missId: 'miss' });
    this.missPreview.setText(missTextFor(audio.settings));
  }

  private smallButton(x: number, y: number, label: string, onClick: () => void): void {
    this.add.rectangle(x, y, 36, 36, COLORS.field).setStrokeStyle(2, COLORS.fieldBorder).setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    this.add.text(x, y, label, { fontFamily: UI_FONT, fontSize: '22px', color: COLORS.text }).setOrigin(0.5);
  }

  private testButton(x: number, y: number, onClick: () => void, label = '▶ Probar'): void {
    const t = this.add.text(x, y, label, { fontFamily: UI_FONT, fontSize: '20px', color: COLORS.accentText }).setInteractive({ useHandCursor: true });
    t.on('pointerdown', onClick);
  }

  // ---------- estado ----------

  private refresh(): void {
    const s = audio.settings;
    for (const r of this.radios) {
      const selected = r.group === 'correct' ? s.correctId === r.id : s.missId === r.id;
      r.text.setText(`(${selected ? '•' : ' '}) ${r.text.text.slice(4)}`).setColor(selected ? COLORS.accentText : COLORS.text);
    }
    for (const b of this.volumeBars) {
      b.fill.width = 260 * s[b.key];
      b.label.setText(`${Math.round(s[b.key] * 100)}%`);
    }
    this.muteText.setText(s.muted ? '🔇 Silencio: sí' : '🔊 Silencio: no');
    for (const theme of Object.keys(this.musicTexts) as MusicThemeId[]) {
      const option = FEEDBACK_CATALOG.music[theme].find((o) => o.id === s.musicByTheme[theme]);
      this.musicTexts[theme]?.setText(option?.label ?? '');
    }
  }

  private close(): void {
    audio.stopPreview();
    if (this.params.overlay) {
      this.scene.stop();
      this.game.events.emit(SETTINGS_CLOSED_EVENT);
    } else {
      this.scene.start(this.params.returnTo ?? 'Title');
    }
  }
}
