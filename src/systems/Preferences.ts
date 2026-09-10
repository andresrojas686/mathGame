import { MAX_NAME_LENGTH } from '../types';

const NAME_KEY = 'multiplicon.name';
const TRAINER_KEY = 'multiplicon.trainer';

/** Deja el nombre como se guarda y se muestra: sin espacios sobrantes y con el largo máximo. */
export function sanitizeName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

/** localStorage puede no existir o lanzar (modo privado, permisos); nunca debe romper el juego. */
function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* sin persistencia: se sigue jugando igual */
  }
}

export function loadLastName(): string {
  return sanitizeName(read(NAME_KEY));
}

export function saveLastName(name: string): void {
  write(NAME_KEY, sanitizeName(name));
}

export function loadLastTrainer(): string {
  return read(TRAINER_KEY);
}

export function saveLastTrainer(id: string): void {
  write(TRAINER_KEY, id);
}
