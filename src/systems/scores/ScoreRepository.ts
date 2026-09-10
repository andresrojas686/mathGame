import type { LeaderboardData, ScoreEntry, ScoreSubmission } from '../../types';
import type { BoardKey } from '../../types';

export interface RepositorySubmitResult {
  entry: ScoreEntry;
  position: number;
  board: BoardKey;
}

/** Origen de puntuaciones. Dos implementaciones: HTTP (normal) y localStorage (respaldo). */
export interface ScoreRepository {
  submit(submission: ScoreSubmission): Promise<RepositorySubmitResult>;
  leaderboard(): Promise<LeaderboardData>;
}

/** Interfaz mínima de localStorage, para poder probar sin navegador. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function safeStorage(): KeyValueStorage | null {
  try {
    const s = globalThis.localStorage;
    // Algunos navegadores lanzan al tocar localStorage en modo privado.
    s.getItem('multiplicon.probe');
    return s;
  } catch {
    return null;
  }
}
