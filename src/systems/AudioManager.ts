import { FEEDBACK_CATALOG, findCorrect, findMusic, type MusicOption, type MusicThemeId, type SoundOption } from '../config/feedback';
import { loadSettings, saveSettings, type FeedbackSettings } from './FeedbackSettings';

/**
 * Música y efectos sintetizados con Web Audio (plan.md §9), sin archivos:
 * - Loops generativos sin corte, con capa de tensión que entra y sale con fundido de 300 ms.
 * - Ducking: la música baja 4 dB durante los efectos de acierto y ataque y vuelve en 200 ms.
 * - Política de autoplay: el contexto se crea en el primer gesto del usuario; hasta entonces
 *   la pista pedida queda pendiente y arranca sola al desbloquear.
 * - Silencio y pausa del reloj al perder el foco de la pestaña.
 */
export type SfxName = 'key' | 'correct' | 'attack' | 'defeated' | 'gameover';

/** Evento de ventana que se despacha cuando cambian las preferencias de audio. */
export const AUDIO_CHANGED_EVENT = 'multiplicon:audio-changed';

interface TrackPreset {
  wave: OscillatorType;
  /** Nota MIDI raíz. */
  root: number;
  /** Intervalos de la escala en semitonos. */
  scale: number[];
  /** Índices de la escala por paso de semicorchea; -1 = silencio. */
  arp: number[];
  /** Cada cuántos pasos suena el bajo. */
  bassEvery: number;
  kickEvery: number;
  hatEvery: number;
  cutoff: number;
  /** Duración relativa de cada nota del arpegio (0–1 del paso). */
  gate: number;
}

const PRESETS: Record<string, TrackPreset> = {
  'lute-march': { wave: 'triangle', root: 62, scale: [0, 2, 4, 7, 9], arp: [0, 2, 4, 2, 1, 3, 4, 3, 0, 2, 4, 7, 4, 2, 1, 0], bassEvery: 4, kickEvery: 8, hatEvery: 4, cutoff: 2200, gate: 0.6 },
  meadow: { wave: 'sine', root: 67, scale: [0, 2, 4, 5, 7, 9, 11], arp: [0, -1, 2, -1, 4, -1, 2, -1, 5, -1, 4, -1, 2, -1, 0, -1], bassEvery: 8, kickEvery: 16, hatEvery: 8, cutoff: 1800, gate: 0.8 },
  'organ-waltz': { wave: 'square', root: 57, scale: [0, 2, 3, 5, 7, 8, 11], arp: [0, 2, 4, 0, 2, 4, 1, 3, 5, 1, 3, 5, 0, 4, 2, 4, 6, 4, 2, 0, 5, 3, 1, 3], bassEvery: 6, kickEvery: 12, hatEvery: 2, cutoff: 900, gate: 0.5 },
  tide: { wave: 'triangle', root: 50, scale: [0, 2, 3, 5, 7, 8, 10], arp: [0, 2, 4, 6, 4, 2, 0, -1, 1, 3, 5, 7, 5, 3, 1, -1], bassEvery: 8, kickEvery: 8, hatEvery: 4, cutoff: 1400, gate: 0.9 },
  'pulse-drive': { wave: 'sawtooth', root: 52, scale: [0, 2, 3, 5, 7, 8, 10], arp: [0, 0, 7, 0, 4, 0, 7, 4, 0, 0, 7, 0, 5, 0, 7, 5], bassEvery: 2, kickEvery: 4, hatEvery: 2, cutoff: 1200, gate: 0.35 },
  void: { wave: 'sine', root: 48, scale: [0, 2, 3, 5, 7, 8, 10], arp: [0, -1, -1, 4, -1, -1, 2, -1, -1, -1, 6, -1, -1, 4, -1, -1], bassEvery: 16, kickEvery: 8, hatEvery: 4, cutoff: 800, gate: 1 },
  lobby: { wave: 'sine', root: 60, scale: [0, 2, 4, 7, 9, 11], arp: [0, -1, 2, -1, 4, -1, -1, -1, 3, -1, 2, -1, 0, -1, -1, -1], bassEvery: 8, kickEvery: 0, hatEvery: 8, cutoff: 1600, gate: 0.9 },
};

const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const DUCK_GAIN = 10 ** (-4 / 20); // −4 dB

class TrackPlayer {
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  readonly out: GainNode;
  private readonly tensionOut: GainNode;
  private readonly filter: BiquadFilterNode;
  private noise: AudioBuffer;

  constructor(
    private readonly ctx: AudioContext,
    private readonly preset: TrackPreset,
    private readonly bpm: number,
    gain: number,
    destination: AudioNode,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = preset.cutoff;
    this.filter.connect(this.out);
    this.out.connect(destination);
    this.tensionOut = ctx.createGain();
    this.tensionOut.gain.value = 0;
    this.tensionOut.connect(this.out);
    this.noise = makeNoise(ctx);
    this.targetGain = gain;
  }

  targetGain: number;

  start(fadeSec: number): void {
    this.nextTime = this.ctx.currentTime + 0.05;
    this.out.gain.cancelScheduledValues(this.ctx.currentTime);
    this.out.gain.setValueAtTime(0, this.ctx.currentTime);
    this.out.gain.linearRampToValueAtTime(this.targetGain, this.ctx.currentTime + fadeSec);
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop(fadeSec: number): void {
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(0, t + fadeSec);
    window.setTimeout(() => {
      if (this.timer !== null) window.clearInterval(this.timer);
      this.timer = null;
      this.out.disconnect();
    }, fadeSec * 1000 + 100);
  }

  setTension(on: boolean): void {
    const t = this.ctx.currentTime;
    this.tensionOut.gain.cancelScheduledValues(t);
    this.tensionOut.gain.setValueAtTime(this.tensionOut.gain.value, t);
    this.tensionOut.gain.linearRampToValueAtTime(on ? 1 : 0, t + 0.3);
  }

  private schedule(): void {
    const stepSec = 60 / this.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime, stepSec);
      this.step = (this.step + 1) % this.preset.arp.length;
      this.nextTime += stepSec;
    }
  }

  private playStep(step: number, t: number, stepSec: number): void {
    const p = this.preset;
    const idx = p.arp[step] ?? -1;
    if (idx >= 0) {
      const degree = p.scale[idx % p.scale.length] ?? 0;
      const octave = Math.floor(idx / p.scale.length) * 12;
      this.tone(p.wave, midiToHz(p.root + 12 + degree + octave), t, stepSec * p.gate, 0.18, this.filter);
    }
    if (p.bassEvery && step % p.bassEvery === 0) {
      const degree = p.scale[(idx >= 0 ? idx : 0) % p.scale.length] ?? 0;
      this.tone('triangle', midiToHz(p.root - 12 + degree), t, stepSec * p.bassEvery * 0.8, 0.22, this.filter);
    }
    if (p.kickEvery && step % p.kickEvery === 0) this.kick(t, this.out);
    if (p.hatEvery && step % p.hatEvery === 0) this.hat(t, 0.05, this.out);
    // Capa de tensión: pad grave y charles en cada paso; solo se oye cuando tensionOut > 0.
    if (step % 8 === 0) this.tone('sawtooth', midiToHz(p.root - 24), t, stepSec * 8, 0.12, this.tensionOut);
    if (step % 2 === 1) this.hat(t, 0.08, this.tensionOut);
  }

  private tone(wave: OscillatorType, hz: number, t: number, dur: number, vol: number, dest: AudioNode): void {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.value = hz;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.03, dur));
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + Math.max(0.03, dur) + 0.02);
  }

  private kick(t: number, dest: AudioNode): void {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  private hat(t: number, vol: number, dest: AudioNode): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    src.connect(hp).connect(g).connect(dest);
    src.start(t);
    src.stop(t + 0.05);
  }
}

function makeNoise(ctx: AudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export class AudioManager {
  settings: FeedbackSettings;
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private duck!: GainNode;
  private sfxBus!: GainNode;
  private noise: AudioBuffer | null = null;
  private current: { theme: MusicThemeId; player: TrackPlayer } | null = null;
  private pendingTheme: MusicThemeId | null = null;
  private tension = false;
  private detune = 0;
  private preview: TrackPlayer | null = null;
  private previewTimer: number | null = null;
  private unlocked = false;

  constructor() {
    this.settings = loadSettings();
  }

  get isUnlocked(): boolean {
    return this.unlocked;
  }

  /** Llamar una vez al arrancar: espera el primer gesto y gestiona el foco de la pestaña. */
  install(): void {
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });
    document.addEventListener('visibilitychange', () => (document.hidden ? this.suspend() : this.resume()));
    window.addEventListener('blur', () => this.suspend());
    window.addEventListener('focus', () => this.resume());
  }

  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.duck = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus.connect(this.duck).connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.noise = makeNoise(this.ctx);
      this.applyVolumes();
    }
    void this.ctx.resume();
    this.unlocked = true;
    if (this.pendingTheme) {
      const theme = this.pendingTheme;
      this.pendingTheme = null;
      this.playMusic(theme);
    }
  }

  // ---------- preferencias ----------

  updateSettings(patch: Partial<FeedbackSettings>): void {
    const before = this.settings;
    this.settings = { ...before, ...patch };
    saveSettings(this.settings);
    this.applyVolumes();
    window.dispatchEvent(new CustomEvent(AUDIO_CHANGED_EVENT));
    // Si cambió la pista del mundo que suena, cambiar en caliente.
    if (this.current && patch.musicByTheme && patch.musicByTheme[this.current.theme] !== before.musicByTheme[this.current.theme]) {
      const theme = this.current.theme;
      this.stopMusic(0.3);
      this.playMusic(theme);
    }
  }

  toggleMute(): boolean {
    this.updateSettings({ muted: !this.settings.muted });
    return this.settings.muted;
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.settings.muted ? 0 : 1, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.settings.musicVolume, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(this.settings.sfxVolume, t, 0.02);
  }

  // ---------- música ----------

  setDetune(cents: number): void {
    this.detune = cents;
  }

  playMusic(theme: MusicThemeId): void {
    if (!this.ctx || !this.unlocked) {
      this.pendingTheme = theme;
      return;
    }
    if (this.current?.theme === theme) return;
    const option = findMusic(theme, this.settings.musicByTheme[theme]) ?? FEEDBACK_CATALOG.music[theme][0];
    if (!option) return;
    this.stopMusic(0.5);
    const player = this.makePlayer(option);
    player.start(0.5);
    player.setTension(this.tension);
    this.current = { theme, player };
  }

  stopMusic(fadeSec = 0.5): void {
    this.current?.player.stop(fadeSec);
    this.current = null;
    this.pendingTheme = null;
  }

  setTension(on: boolean): void {
    if (this.tension === on) return;
    this.tension = on;
    this.current?.player.setTension(on);
  }

  private makePlayer(option: MusicOption): TrackPlayer {
    const preset = PRESETS[option.preset] ?? PRESETS.lobby!;
    return new TrackPlayer(this.ctx!, preset, option.bpm, option.gain, this.musicBus);
  }

  /** Reproduce ocho segundos de una pista y la desvanece (pantalla de ajustes). */
  previewMusic(theme: MusicThemeId, id: string): void {
    this.unlock();
    if (!this.ctx) return;
    const option = findMusic(theme, id);
    if (!option) return;
    this.stopPreview();
    this.current?.player.stop(0.3);
    const savedTheme = this.current?.theme ?? null;
    this.current = null;
    this.preview = this.makePlayer(option);
    this.preview.start(0.3);
    this.previewTimer = window.setTimeout(() => {
      this.stopPreview();
      if (savedTheme) this.playMusic(savedTheme);
    }, 8000);
  }

  stopPreview(): void {
    if (this.previewTimer !== null) window.clearTimeout(this.previewTimer);
    this.previewTimer = null;
    this.preview?.stop(0.3);
    this.preview = null;
  }

  // ---------- efectos ----------

  playSfx(name: SfxName): void {
    if (!this.ctx || !this.unlocked) return;
    if (name === 'correct') {
      const option = findCorrect(this.settings.correctId);
      if (option) this.playPreset(option);
      this.duckMusic();
      return;
    }
    if (name === 'attack') this.duckMusic();
    this.playPreset({ id: name, label: name, preset: name, gain: name === 'key' ? 0.25 : 0.6 });
  }

  /** Para la pantalla de ajustes: suena una opción concreta del catálogo. */
  previewCorrect(id: string): void {
    this.unlock();
    const option = findCorrect(id);
    if (option && this.ctx) this.playPreset(option);
  }

  private duckMusic(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.duck.gain.cancelScheduledValues(t);
    this.duck.gain.setValueAtTime(DUCK_GAIN, t);
    this.duck.gain.linearRampToValueAtTime(1, t + 0.2);
  }

  private playPreset(option: SoundOption): void {
    const ctx = this.ctx!;
    if (option.gain <= 0 || option.preset === 'none') return;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = option.gain;
    out.connect(this.sfxBus);
    const detune = (option.detune ?? 0) + this.detune;
    const tone = (wave: OscillatorType, hz: number, start: number, dur: number, vol: number, slideTo?: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(hz, t + start);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + start + dur);
      osc.detune.value = detune;
      g.gain.setValueAtTime(0, t + start);
      g.gain.linearRampToValueAtTime(vol, t + start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
      osc.connect(g).connect(out);
      osc.start(t + start);
      osc.stop(t + start + dur + 0.02);
    };
    const burst = (start: number, dur: number, vol: number, hp = 1000) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise!;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = hp;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t + start);
      g.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
      src.connect(f).connect(g).connect(out);
      src.start(t + start);
      src.stop(t + start + dur + 0.01);
    };

    switch (option.preset) {
      case 'key':
        burst(0, 0.04, 0.5, 2500);
        break;
      case 'chime':
        tone('sine', 659, 0, 0.25, 0.5);
        tone('sine', 880, 0.09, 0.3, 0.5);
        break;
      case 'spark':
        tone('square', 500, 0, 0.14, 0.3, 1600);
        break;
      case 'coin':
        tone('square', 988, 0, 0.08, 0.35);
        tone('square', 1319, 0.08, 0.3, 0.35);
        break;
      case 'clap':
        burst(0, 0.05, 0.5, 1500);
        burst(0.05, 0.05, 0.45, 1500);
        burst(0.1, 0.12, 0.4, 1500);
        break;
      case 'attack':
        tone('sine', 200, 0, 0.3, 0.7, 55);
        burst(0, 0.15, 0.4, 400);
        break;
      case 'defeated':
        [523, 659, 784, 1047].forEach((hz, i) => tone('triangle', hz, i * 0.11, 0.35, 0.4));
        break;
      case 'gameover':
        [392, 311, 233].forEach((hz, i) => tone('triangle', hz, i * 0.4, 0.7, 0.4));
        this.stopMusic(2);
        break;
      default:
        tone('sine', 660, 0, 0.2, 0.4);
    }
  }

  // ---------- foco ----------

  private suspend(): void {
    void this.ctx?.suspend();
  }

  private resume(): void {
    if (this.unlocked) void this.ctx?.resume();
  }
}

export const audio = new AudioManager();
