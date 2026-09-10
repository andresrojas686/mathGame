import { describe, expect, it } from 'vitest';
import type { LeaderboardData, ScoreSubmission } from '../../types';
import { LocalScoreRepository, emptyLeaderboard } from './LocalScoreRepository';
import type { KeyValueStorage, RepositorySubmitResult, ScoreRepository } from './ScoreRepository';
import { ScoreService } from './ScoreService';

class MemoryStorage implements KeyValueStorage {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

class FakeRemote implements ScoreRepository {
  up = true;
  received: ScoreSubmission[] = [];
  async submit(s: ScoreSubmission): Promise<RepositorySubmitResult> {
    if (!this.up) throw new Error('caído');
    this.received.push(s);
    return { entry: { name: s.name, correct: s.correct, waves: s.waves, date: '2026-09-10T00:00:00.000Z' }, position: 1, board: `${s.operation}:${s.level}` };
  }
  async leaderboard(): Promise<LeaderboardData> {
    if (!this.up) throw new Error('caído');
    return emptyLeaderboard();
  }
}

const sub = (correct: number): ScoreSubmission => ({ name: 'Sofía', level: 'facil', operation: 'multiplicar', correct, waves: 0 });

describe('LocalScoreRepository', () => {
  it('guarda ordenado, persiste en storage y calcula la posición', async () => {
    const storage = new MemoryStorage();
    let t = 0;
    const repo = new LocalScoreRepository(storage, () => new Date(2026, 8, 10, 0, 0, t++));
    await repo.submit(sub(3));
    const r = await repo.submit(sub(9));
    expect(r.position).toBe(1);
    const again = new LocalScoreRepository(storage);
    const lb = await again.leaderboard();
    expect(lb.boards['multiplicar:facil'].map((e) => e.correct)).toEqual([9, 3]);
  });

  it('funciona sin storage (en memoria)', async () => {
    const repo = new LocalScoreRepository(null);
    await repo.submit(sub(1));
    expect((await repo.leaderboard()).boards['multiplicar:facil']).toHaveLength(1);
    repo.enqueue(sub(1));
    expect(repo.pending()).toHaveLength(1);
  });
});

describe('ScoreService', () => {
  it('con servidor arriba envía y marca source=server', async () => {
    const remote = new FakeRemote();
    const local = new LocalScoreRepository(new MemoryStorage());
    const svc = new ScoreService(remote, local);
    const r = await svc.submit(sub(5));
    expect(r.source).toBe('server');
    expect(local.pending()).toEqual([]);
  });

  it('con servidor caído guarda local, encola y luego reenvía con flushPending', async () => {
    const remote = new FakeRemote();
    remote.up = false;
    const local = new LocalScoreRepository(new MemoryStorage());
    const svc = new ScoreService(remote, local);

    const r = await svc.submit(sub(5));
    expect(r.source).toBe('local');
    expect(r.position).toBe(1);
    expect(local.pending()).toHaveLength(1);
    expect((await svc.leaderboard()).source).toBe('local');

    expect(await svc.flushPending()).toBe(0);
    remote.up = true;
    expect(await svc.flushPending()).toBe(1);
    expect(remote.received).toHaveLength(1);
    expect(local.pending()).toEqual([]);
  });
});
