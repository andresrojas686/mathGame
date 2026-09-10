import { CUSTOM_MISS_ID, FEEDBACK_DEFAULTS, findCorrect, findMiss, findMusic, MISS_MAX_LENGTH, type MusicThemeId } from '../config/feedback';
import type { KeyValueStorage } from './scores/ScoreRepository';
import { safeStorage } from './scores/ScoreRepository';

export const FEEDBACK_KEY = 'multiplicon.feedback';

export interface FeedbackSettings {
  musicByTheme: Record<MusicThemeId, string>;
  correctId: string;
  missId: string;
  /** Si missId === 'custom'. */
  missCustomText?: string;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

/** Deja el texto personalizado como se mostrará: sin espacios sobrantes, mayúsculas, máx. 8. */
export function sanitizeMissText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MISS_MAX_LENGTH).toUpperCase();
}

const clamp01 = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback);

/**
 * Valida una preferencia guardada contra el catálogo. Si un id ya no existe (porque se quitó
 * una opción entre versiones) se cae al valor por defecto en lugar de fallar: un juego que
 * arranca mudo por una preferencia vieja es de los bugs más difíciles de diagnosticar.
 */
export function validateSettings(raw: unknown): FeedbackSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<FeedbackSettings> & { musicByTheme?: Partial<Record<MusicThemeId, string>> };
  const musicByTheme = { ...FEEDBACK_DEFAULTS.music };
  for (const theme of Object.keys(musicByTheme) as MusicThemeId[]) {
    const id = r.musicByTheme?.[theme];
    if (typeof id === 'string' && findMusic(theme, id)) musicByTheme[theme] = id;
  }
  const correctId = typeof r.correctId === 'string' && findCorrect(r.correctId) ? r.correctId : FEEDBACK_DEFAULTS.correct;

  let missId = FEEDBACK_DEFAULTS.miss;
  let missCustomText: string | undefined;
  if (r.missId === CUSTOM_MISS_ID) {
    const text = sanitizeMissText(typeof r.missCustomText === 'string' ? r.missCustomText : '');
    if (text) {
      missId = CUSTOM_MISS_ID;
      missCustomText = text;
    }
  } else if (typeof r.missId === 'string' && findMiss(r.missId)) {
    missId = r.missId;
  }

  const out: FeedbackSettings = {
    musicByTheme,
    correctId,
    missId,
    musicVolume: clamp01(r.musicVolume, FEEDBACK_DEFAULTS.musicVolume),
    sfxVolume: clamp01(r.sfxVolume, FEEDBACK_DEFAULTS.sfxVolume),
    muted: r.muted === true,
  };
  if (missCustomText) out.missCustomText = missCustomText;
  return out;
}

/** Texto de fallo efectivo según las preferencias. */
export function missTextFor(s: FeedbackSettings): string {
  if (s.missId === CUSTOM_MISS_ID && s.missCustomText) return s.missCustomText;
  return findMiss(s.missId)?.text ?? findMiss(FEEDBACK_DEFAULTS.miss)!.text;
}

export function loadSettings(storage: KeyValueStorage | null = safeStorage()): FeedbackSettings {
  try {
    const raw = storage?.getItem(FEEDBACK_KEY);
    return validateSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return validateSettings(null);
  }
}

export function saveSettings(s: FeedbackSettings, storage: KeyValueStorage | null = safeStorage()): void {
  try {
    storage?.setItem(FEEDBACK_KEY, JSON.stringify(s));
  } catch {
    /* sin persistencia */
  }
}
