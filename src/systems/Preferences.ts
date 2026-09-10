import { MAX_NAME_LENGTH } from '../types';

const NAME_KEY = 'multiplicon.name';

/** Deja el nombre como se guarda y se muestra: sin espacios sobrantes y con el largo máximo. */
export function sanitizeName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

/** localStorage puede no existir o lanzar (modo privado, permisos); nunca debe romper el juego. */
export function loadLastName(): string {
  try {
    return sanitizeName(localStorage.getItem(NAME_KEY) ?? '');
  } catch {
    return '';
  }
}

export function saveLastName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, sanitizeName(name));
  } catch {
    /* sin persistencia: se sigue jugando igual */
  }
}
