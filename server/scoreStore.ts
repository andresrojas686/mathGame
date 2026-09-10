import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  boardKey,
  emptyScoresFile,
  KEEP_PER_BOARD,
  type ScoreEntry,
  type ScoreInput,
  type ScoresFile,
  type SubmitResult,
} from './types.js';

/** Orden del ranking: más aciertos primero; en empate gana la partida más antigua. */
export function compareEntries(a: ScoreEntry, b: ScoreEntry): number {
  return b.correct - a.correct || a.date.localeCompare(b.date);
}

/**
 * Inserta la entrada en la tabla ordenada y devuelve su posición real (1-based).
 * La tabla devuelta se recorta a KEEP_PER_BOARD; la posición se calcula antes del recorte.
 */
export function insertEntry(board: ScoreEntry[], entry: ScoreEntry): { board: ScoreEntry[]; position: number } {
  const merged = [...board, entry].sort(compareEntries);
  const position = merged.indexOf(entry) + 1;
  return { board: merged.slice(0, KEEP_PER_BOARD), position };
}

/**
 * Ranking persistido en un archivo JSON.
 * - Escritura atómica: se escribe un temporal y se renombra sobre el definitivo.
 * - Cola en memoria: dos partidas que terminan a la vez no se pisan.
 */
export class ScoreStore {
  private data: ScoresFile | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async load(): Promise<ScoresFile> {
    if (this.data) return this.data;
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<ScoresFile>;
      const fresh = emptyScoresFile();
      if (parsed && parsed.version === 2 && parsed.boards) {
        for (const key of Object.keys(fresh.boards) as (keyof ScoresFile['boards'])[]) {
          const list = parsed.boards[key];
          if (Array.isArray(list)) fresh.boards[key] = list.slice().sort(compareEntries).slice(0, KEEP_PER_BOARD);
        }
      }
      this.data = fresh;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') console.warn(`scores: no se pudo leer ${this.filePath}, se empieza vacío:`, err);
      this.data = emptyScoresFile();
    }
    return this.data;
  }

  async leaderboard(): Promise<ScoresFile> {
    return this.load();
  }

  submit(input: ScoreInput, now: Date = new Date()): Promise<SubmitResult> {
    const run = async (): Promise<SubmitResult> => {
      const data = await this.load();
      const key = boardKey(input.operation, input.level);
      const entry: ScoreEntry = { name: input.name, correct: input.correct, waves: input.waves, date: now.toISOString() };
      const { board, position } = insertEntry(data.boards[key], entry);
      data.boards[key] = board;
      await this.persist(data);
      return { entry, position, board: key };
    };
    // La cola encadena cada escritura tras la anterior, incluso si una falla.
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async persist(data: ScoresFile): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    // En Windows el rename sobre un archivo que el antivirus acaba de abrir falla con EPERM
    // de forma transitoria; unos reintentos cortos lo resuelven sin perder la atomicidad.
    for (let attempt = 0; ; attempt++) {
      try {
        await rename(tmp, this.filePath);
        return;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if ((code !== 'EPERM' && code !== 'EBUSY') || attempt >= 5) throw err;
        await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
      }
    }
  }
}
