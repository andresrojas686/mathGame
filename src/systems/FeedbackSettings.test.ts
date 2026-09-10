import { describe, expect, it } from 'vitest';
import { FEEDBACK_DEFAULTS } from '../config/feedback';
import { loadSettings, missTextFor, sanitizeMissText, saveSettings, validateSettings } from './FeedbackSettings';
import type { KeyValueStorage } from './scores/ScoreRepository';

class MemoryStorage implements KeyValueStorage {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

describe('validateSettings', () => {
  it('con nada devuelve los valores por defecto', () => {
    const s = validateSettings(null);
    expect(s.correctId).toBe(FEEDBACK_DEFAULTS.correct);
    expect(s.missId).toBe('miss');
    expect(s.musicByTheme.facil).toBe('lute-march');
    expect(s.musicVolume).toBe(0.7);
    expect(s.muted).toBe(false);
  });

  it('un id que ya no existe cae al valor por defecto sin fallar', () => {
    const s = validateSettings({ correctId: 'trompeta', missId: 'nope', musicByTheme: { facil: 'desaparecida', normal: 'tide' } });
    expect(s.correctId).toBe('chime');
    expect(s.missId).toBe('miss');
    expect(s.musicByTheme.facil).toBe('lute-march');
    expect(s.musicByTheme.normal).toBe('tide');
  });

  it('texto personalizado: se sanea, limita a 8 y si queda vacío vuelve al defecto', () => {
    expect(validateSettings({ missId: 'custom', missCustomText: '  otra   vez más ' })).toMatchObject({ missId: 'custom', missCustomText: 'OTRA VEZ' });
    expect(validateSettings({ missId: 'custom', missCustomText: '   ' }).missId).toBe('miss');
    expect(sanitizeMissText('casi casi')).toBe('CASI CAS');
  });

  it('volúmenes fuera de rango se recortan', () => {
    const s = validateSettings({ musicVolume: 4, sfxVolume: -1 });
    expect(s.musicVolume).toBe(1);
    expect(s.sfxVolume).toBe(0);
    expect(validateSettings({ musicVolume: 'alto' }).musicVolume).toBe(0.7);
  });
});

describe('missTextFor / persistencia', () => {
  it('devuelve el texto del catálogo o el personalizado', () => {
    expect(missTextFor(validateSettings({ missId: 'casi' }))).toBe('CASI');
    expect(missTextFor(validateSettings({ missId: 'custom', missCustomText: 'uf' }))).toBe('UF');
  });
  it('guarda y carga desde storage; un JSON roto no rompe', () => {
    const st = new MemoryStorage();
    saveSettings(validateSettings({ correctId: 'coin', muted: true }), st);
    expect(loadSettings(st)).toMatchObject({ correctId: 'coin', muted: true });
    st.setItem('multiplicon.feedback', '{rot');
    expect(loadSettings(st).correctId).toBe('chime');
  });
});
