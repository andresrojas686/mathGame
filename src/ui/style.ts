/** Estilo compartido por los menús. El combate usa la paleta del gimnasio (config/themes.ts). */
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

/**
 * Atkinson Hyperlegible para todo: distingue 0/O, 1/7 y 6/8 mejor que cualquier fuente
 * decorativa, y el número es lo único que de verdad tiene que leerse rápido.
 */
export const FONT_FAMILY = '"Atkinson Hyperlegible", "Segoe UI", Arial, sans-serif';
export const NUMBER_FONT = FONT_FAMILY;
export const UI_FONT = FONT_FAMILY;

export const W = 1280;
export const H = 720;

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}
