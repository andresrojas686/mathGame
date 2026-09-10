import type { DifficultyId } from '../types';

/**
 * Catálogo de retroalimentación (plan.md §9). Ni un nombre de sonido ni un texto de interfaz
 * aparece fijo en las escenas: todo sale de aquí y el jugador elige desde Ajustes.
 *
 * El audio se sintetiza con Web Audio en vez de cargar archivos: no hay licencias que
 * verificar, pesa cero bytes y los loops no tienen corte. Cada opción apunta a un preset
 * de `AudioManager` en lugar de a un archivo.
 */
export interface SoundOption {
  id: string;
  /** Lo que ve el usuario: "Campana". */
  label: string;
  /** Preset del sintetizador. */
  preset: string;
  /** Normalización, 0–1. */
  gain: number;
  /** Ajuste de tono en cents. */
  detune?: number;
}

export interface MusicOption extends SoundOption {
  bpm: number;
}

export interface MissMessage {
  id: string;
  /** Máx. 8 caracteres. */
  text: string;
}

export type MusicThemeId = DifficultyId | 'menu';

export const MISS_MAX_LENGTH = 8;
export const CUSTOM_MISS_ID = 'custom';

export const FEEDBACK_CATALOG = {
  music: {
    facil: [
      { id: 'lute-march', label: 'Marcha de laúd', preset: 'lute-march', gain: 0.5, bpm: 100 },
      { id: 'meadow', label: 'Pradera', preset: 'meadow', gain: 0.5, bpm: 92 },
    ],
    normal: [
      { id: 'organ-waltz', label: 'Vals de órgano', preset: 'organ-waltz', gain: 0.45, bpm: 120 },
      { id: 'tide', label: 'Marea', preset: 'tide', gain: 0.45, bpm: 112 },
    ],
    dificil: [
      { id: 'pulse-drive', label: 'Pulso', preset: 'pulse-drive', gain: 0.4, bpm: 140 },
      { id: 'void', label: 'Vacío', preset: 'void', gain: 0.4, bpm: 128 },
    ],
    menu: [{ id: 'lobby', label: 'Vestíbulo', preset: 'lobby', gain: 0.35, bpm: 84 }],
  } satisfies Record<MusicThemeId, MusicOption[]>,
  correct: [
    { id: 'chime', label: 'Campana', preset: 'chime', gain: 0.6 },
    { id: 'spark', label: 'Chispa', preset: 'spark', gain: 0.5 },
    { id: 'coin', label: 'Moneda', preset: 'coin', gain: 0.55 },
    { id: 'clap', label: 'Aplauso corto', preset: 'clap', gain: 0.5 },
    { id: 'none', label: 'Sin sonido', preset: 'none', gain: 0 },
  ] satisfies SoundOption[],
  miss: [
    { id: 'miss', text: 'MISS' },
    { id: 'uy', text: '¡UY!' },
    { id: 'casi', text: 'CASI' },
    { id: 'otra', text: 'OTRA VEZ' },
  ] satisfies MissMessage[],
};

export const FEEDBACK_DEFAULTS = {
  music: { facil: 'lute-march', normal: 'organ-waltz', dificil: 'pulse-drive', menu: 'lobby' } as Record<MusicThemeId, string>,
  correct: 'chime',
  miss: 'miss',
  musicVolume: 0.7,
  sfxVolume: 0.9,
  muted: false,
};

export function findMusic(theme: MusicThemeId, id: string): MusicOption | undefined {
  return FEEDBACK_CATALOG.music[theme].find((m) => m.id === id);
}

export function findCorrect(id: string): SoundOption | undefined {
  return FEEDBACK_CATALOG.correct.find((s) => s.id === id);
}

export function findMiss(id: string): MissMessage | undefined {
  return FEEDBACK_CATALOG.miss.find((m) => m.id === id);
}
