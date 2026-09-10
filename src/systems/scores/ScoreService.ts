import type { LeaderboardData, ScoreSource, ScoreSubmission, SubmitOutcome } from '../../types';
import { HttpScoreRepository } from './HttpScoreRepository';
import { LocalScoreRepository } from './LocalScoreRepository';
import type { ScoreRepository } from './ScoreRepository';

export interface LeaderboardResult {
  data: LeaderboardData;
  source: ScoreSource;
}

/**
 * Envía al servidor y, si no responde, guarda en local y encola el reintento.
 * Un niño que juega bien y pierde su puntaje por la red no vuelve a jugar.
 */
export class ScoreService {
  constructor(
    private readonly remote: ScoreRepository,
    private readonly local: LocalScoreRepository,
  ) {}

  async submit(submission: ScoreSubmission): Promise<SubmitOutcome> {
    try {
      const r = await this.remote.submit(submission);
      return { ...r, source: 'server' };
    } catch (err) {
      console.warn('ranking: el servidor no respondió, se guarda en local', err);
      this.local.enqueue(submission);
      const r = await this.local.submit(submission);
      return { ...r, source: 'local' };
    }
  }

  async leaderboard(): Promise<LeaderboardResult> {
    try {
      return { data: await this.remote.leaderboard(), source: 'server' };
    } catch (err) {
      console.warn('ranking: el servidor no respondió, se muestra el local', err);
      return { data: await this.local.leaderboard(), source: 'local' };
    }
  }

  /** Reintenta los envíos pendientes en orden; se detiene en el primer fallo. Devuelve cuántos se enviaron. */
  async flushPending(): Promise<number> {
    const pending = this.local.pending();
    let sent = 0;
    for (const s of pending) {
      try {
        await this.remote.submit(s);
        sent += 1;
      } catch {
        break;
      }
    }
    if (sent > 0) this.local.writePending(pending.slice(sent));
    return sent;
  }
}

export const scores = new ScoreService(new HttpScoreRepository(), new LocalScoreRepository());
