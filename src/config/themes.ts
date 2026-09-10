import type { DifficultyId } from '../types';

/** Paleta de un gimnasio (plan.md §7). Los números nunca cambian de tipografía ni de contraste. */
export interface Palette {
  bg: number;
  primary: number;
  secondary: number;
  accent: number;
  text: string;
  textHex: number;
  muted: string;
  danger: string;
  dangerHex: number;
}

export interface Theme {
  id: DifficultyId;
  name: string;
  palette: Palette;
  /** Claves de textura de las tres capas de fondo, del fondo al frente. */
  layers: [string, string, string];
  /** Ajuste de tono de los efectos, en cents (plan.md §9). */
  sfxDetune: number;
}

export const THEMES: Record<DifficultyId, Theme> = {
  facil: {
    id: 'facil',
    name: 'Gimnasio de roca y planta',
    palette: {
      bg: 0x2a1f1a,
      primary: 0x8c6a4a,
      secondary: 0x6b8f5e,
      accent: 0xe8c87a,
      text: '#f2e9d8',
      textHex: 0xf2e9d8,
      muted: '#b8a88f',
      danger: '#ff5470',
      dangerHex: 0xff5470,
    },
    layers: ['gym-facil-sky', 'gym-facil-mid', 'gym-facil-front'],
    sfxDetune: 0,
  },
  normal: {
    id: 'normal',
    name: 'Gimnasio de agua y eléctrico',
    palette: {
      bg: 0x12202b,
      primary: 0x2f7fb8,
      secondary: 0xc9d6df,
      accent: 0xe4b363,
      text: '#f2e9d8',
      textHex: 0xf2e9d8,
      muted: '#9fb0bd',
      danger: '#ff5470',
      dangerHex: 0xff5470,
    },
    layers: ['gym-normal-sky', 'gym-normal-mid', 'gym-normal-front'],
    sfxDetune: -200,
  },
  dificil: {
    id: 'dificil',
    name: 'Gimnasio psíquico y fantasma',
    palette: {
      bg: 0x0f0a1e,
      primary: 0xb45cff,
      secondary: 0x00d9c0,
      accent: 0x00d9c0,
      text: '#e6f1ff',
      textHex: 0xe6f1ff,
      muted: '#9a90b8',
      danger: '#ff5470',
      dangerHex: 0xff5470,
    },
    layers: ['gym-dificil-sky', 'gym-dificil-mid', 'gym-dificil-front'],
    sfxDetune: 300,
  },
};

export const THEME_IDS: DifficultyId[] = ['facil', 'normal', 'dificil'];

/** Rutas de los SVG de fondo, en el mismo orden que `layers`. */
export function themeLayerPaths(id: DifficultyId): [string, string, string] {
  return [`assets/gyms/${id}/bg-sky.svg`, `assets/gyms/${id}/bg-mid.svg`, `assets/gyms/${id}/bg-front.svg`];
}

export const HEART_FULL_KEY = 'heart-full';
export const HEART_EMPTY_KEY = 'heart-empty';
