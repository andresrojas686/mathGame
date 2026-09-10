import { boardKey, type BoardKey, type DifficultyId, type LeaderboardData, type Operation, type ScoreEntry, type ScoreSubmission } from '../../types';
import { safeStorage, type KeyValueStorage, type RepositorySubmitResult, type ScoreRepository } from './ScoreRepository';

const SCORES_KEY = 'multiplicon.scores';
const PENDING_KEY = 'multiplicon.pending';
const KEEP = 20;
const LEVELS: DifficultyId[] = ['facil', 'normal', 'dificil'];
const OPERATIONS: Operation[] = ['multiplicar', 'dividir'];

export function emptyLeaderboard(): LeaderboardData {
  const boards = {} as Record<BoardKey, ScoreEntry[]>;
  for (const op of OPERATIONS) for (const lv of LEVELS) boards[boardKey(op, lv)] = [];
  return { version: 2, boards };
}

/** Mismo criterio que el servidor: más aciertos primero; en empate, la más antigua. */
export function compareEntries(a: ScoreEntry, b: ScoreEntry): number {
  return b.correct - a.correct || a.date.localeCompare(b.date);
}

/**
 * Respaldo cuando el servidor no responde: ranking propio del dispositivo en localStorage
 * y una cola de envíos pendientes que se reintenta al abrir el juego.
 */
export class LocalScoreRepository implements ScoreRepository {
  private readonly storage: KeyValueStorage | null;
  private memory: LeaderboardData | null = null;
  private memoryPending: ScoreSubmission[] = [];

  constructor(storage: KeyValueStorage | null = safeStorage(), private readonly now: () => Date = () => new Date()) {
    this.storage = storage;
  }

  async submit(submission: ScoreSubmission): Promise<RepositorySubmitResult> {
    const data = this.read();
    const key = boardKey(submission.operation, submission.level);
    const entry: ScoreEntry = { name: submission.name, correct: submission.correct, waves: submission.waves, date: this.now().toISOString() };
    const merged = [...data.boards[key], entry].sort(compareEntries);
    const position = merged.indexOf(entry) + 1;
    data.boards[key] = merged.slice(0, KEEP);
    this.write(data);
    return { entry, position, board: key };
  }

  async leaderboard(): Promise<LeaderboardData> {
    const data = this.read();
    const boards = {} as Record<BoardKey, ScoreEntry[]>;
    for (const k of Object.keys(data.boards) as BoardKey[]) boards[k] = data.boards[k].slice(0, 10);
    return { version: 2, boards };
  }

  // ---- cola de pendientes ----

  enqueue(submission: ScoreSubmission): void {
    const list = this.pending();
    list.push(submission);
    this.writePending(list);
  }

  pending(): ScoreSubmission[] {
    if (!this.storage) return [...this.memoryPending];
    try {
      const raw = this.storage.getItem(PENDING_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(parsed) ? (parsed as ScoreSubmission[]) : [];
    } catch {
      return [];
    }
  }

  writePending(list: ScoreSubmission[]): void {
    if (!this.storage) {
      this.memoryPending = [...list];
      return;
    }
    try {
      if (list.length === 0) this.storage.removeItem(PENDING_KEY);
      else this.storage.setItem(PENDING_KEY, JSON.stringify(list));
    } catch {
      /* sin persistencia */
    }
  }

  // ---- almacenamiento ----

  private read(): LeaderboardData {
    if (this.memory) return this.memory;
    let data = emptyLeaderboard();
    if (this.storage) {
      try {
        const raw = this.storage.getItem(SCORES_KEY);
        const parsed = raw ? (JSON.parse(raw) as Partial<LeaderboardData>) : null;
        if (parsed?.version === 2 && parsed.boards) {
          for (const k of Object.keys(data.boards) as BoardKey[]) {
            const list = parsed.boards[k];
            if (Array.isArray(list)) data.boards[k] = list.slice().sort(compareEntries).slice(0, KEEP);
          }
        }
      } catch {
        data = emptyLeaderboard();
      }
    }
    this.memory = data;
    return data;
  }

  private write(data: LeaderboardData): void {
    this.memory = data;
    try {
      this.storage?.setItem(SCORES_KEY, JSON.stringify(data));
    } catch {
      /* sin persistencia */
    }
  }
}
