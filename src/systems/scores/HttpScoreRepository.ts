import type { LeaderboardData, ScoreSubmission } from '../../types';
import type { RepositorySubmitResult, ScoreRepository } from './ScoreRepository';

export type FetchLike = typeof fetch;

export class HttpScoreRepository implements ScoreRepository {
  constructor(
    private readonly base = '/api',
    private readonly fetchFn: FetchLike = (...args) => fetch(...args),
    private readonly timeoutMs = 5000,
  ) {}

  async submit(submission: ScoreSubmission): Promise<RepositorySubmitResult> {
    const res = await this.request(`${this.base}/scores`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(submission),
    });
    return (await res.json()) as RepositorySubmitResult;
  }

  async leaderboard(): Promise<LeaderboardData> {
    const res = await this.request(`${this.base}/leaderboard`, { method: 'GET' });
    return (await res.json()) as LeaderboardData;
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchFn(url, { ...init, signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
      return res;
    } finally {
      clearTimeout(timer);
    }
  }
}
