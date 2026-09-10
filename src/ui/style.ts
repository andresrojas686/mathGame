/** Estilo provisional compartido por todas las escenas. Los temas reales entran en Fase 4. */
export const COLORS = {
  bg: 0x1e1e2e,
  text: '#f2e9d8',
  muted: '#8a8a9a',
  accentText: '#e8c87a',
  accent: 0xe8c87a,
  heartOn: 0xe8c87a,
  heartOff: 0x3a3a4a,
  timer: 0x6b8f5e,
  timerLow: 0xff5470,
  timerTrack: 0x2c2c3c,
  hpFill: 0xc4643c,
  hpTrack: 0x2c2c3c,
  field: 0x2c2c3c,
  fieldActive: 0x3a3a52,
  fieldBorder: 0x8a8a9a,
  hero: 0x4a90d9,
  monster: 0xc4643c,
  miss: '#e8c87a',
  danger: '#ff5470',
};

export const NUMBER_FONT = 'Consolas, "Courier New", monospace';
export const UI_FONT = '"Segoe UI", Arial, sans-serif';

export const W = 1280;
export const H = 720;

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
