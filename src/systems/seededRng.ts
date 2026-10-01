import type { Rng } from '../types';

/**
 * mulberry32: 32 bits de estado, una línea de aritmética y distribución suficiente
 * para sortear operaciones. Lo que importa aquí no es la calidad criptográfica sino
 * que dos navegadores con la misma semilla produzcan exactamente la misma secuencia,
 * que es lo que hace justa una partida entre varios jugadores.
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semilla a partir de un texto, por si alguna vez conviene derivarla del código de sala. */
export function seedFromString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
