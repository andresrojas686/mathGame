import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { compareEntries, insertEntry, ScoreStore } from './scoreStore';
import { KEEP_PER_BOARD, type ScoreEntry, type ScoreInput } from './types';

const entry = (correct: number, date: string, name = 'x'): ScoreEntry => ({ name, correct, waves: 0, date });
const input = (over: Partial<ScoreInput> = {}): ScoreInput => ({
  name: 'Sofía',
  level: 'facil',
  operation: 'multiplicar',
  correct: 10,
  waves: 1,
  ...over,
});

describe('compareEntries / insertEntry', () => {
  it('ordena por aciertos descendente y, en empate, la fecha más antigua primero', () => {
    const list = [entry(5, '2026-01-02'), entry(9, '2026-01-03'), entry(5, '2026-01-01')].sort(compareEntries);
    expect(list.map((e) => `${e.correct}@${e.date}`)).toEqual(['9@2026-01-03', '5@2026-01-01', '5@2026-01-02']);
  });

  it('devuelve la posición real aunque la entrada quede fuera de las conservadas', () => {
    const board = Array.from({ length: KEEP_PER_BOARD }, (_, i) => entry(100 - i, '2026-01-01'));
    const { board: kept, position } = insertEntry(board, entry(1, '2026-02-01'));
    expect(position).toBe(KEEP_PER_BOARD + 1);
    expect(kept).toHaveLength(KEEP_PER_BOARD);
    expect(kept.some((e) => e.correct === 1)).toBe(false);
  });

  it('una entrada nueva con empate queda detrás de la antigua', () => {
    const { position } = insertEntry([entry(10, '2026-01-01')], entry(10, '2026-01-02'));
    expect(position).toBe(2);
  });
});

describe('ScoreStore', () => {
  let dir: string;
  let file: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'multiplicon-scores-'));
    file = path.join(dir, 'nested', 'scores.json');
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('empieza vacío si el archivo no existe y crea el directorio al guardar', async () => {
    const store = new ScoreStore(file);
    const data = await store.leaderboard();
    expect(Object.keys(data.boards)).toHaveLength(6);
    expect(data.boards['multiplicar:facil']).toEqual([]);

    const r = await store.submit(input(), new Date('2026-09-10T10:00:00Z'));
    expect(r.position).toBe(1);
    expect(r.board).toBe('multiplicar:facil');
    const saved = JSON.parse(await readFile(file, 'utf8'));
    expect(saved.version).toBe(2);
    expect(saved.boards['multiplicar:facil'][0]).toMatchObject({ name: 'Sofía', correct: 10, date: '2026-09-10T10:00:00.000Z' });
  });

  it('no deja archivos temporales tras escribir', async () => {
    const store = new ScoreStore(file);
    await store.submit(input());
    expect(await readdir(path.dirname(file))).toEqual(['scores.json']);
  });

  it('las tablas son independientes por operación y nivel', async () => {
    const store = new ScoreStore(file);
    await store.submit(input({ level: 'normal', correct: 3 }));
    await store.submit(input({ operation: 'dividir', correct: 50 }));
    const data = await store.leaderboard();
    expect(data.boards['multiplicar:facil']).toEqual([]);
    expect(data.boards['multiplicar:normal']).toHaveLength(1);
    expect(data.boards['dividir:facil'][0]?.correct).toBe(50);
  });

  it('envíos concurrentes no se pisan', async () => {
    const store = new ScoreStore(file);
    // Aciertos decrecientes: cada envío queda detrás del anterior. Como el archivo conserva
    // KEEP_PER_BOARD entradas, a partir de ahí toda partida peor queda en la posición KEEP+1.
    const results = await Promise.all(Array.from({ length: 25 }, (_, i) => store.submit(input({ correct: 24 - i }))));
    const expected = Array.from({ length: 25 }, (_, i) => Math.min(i + 1, KEEP_PER_BOARD + 1));
    expect(results.map((r) => r.position)).toEqual(expected);
    const saved = JSON.parse(await readFile(file, 'utf8'));
    expect(saved.boards['multiplicar:facil']).toHaveLength(KEEP_PER_BOARD);
    expect(saved.boards['multiplicar:facil'][0].correct).toBe(24);
  });

  it('relee un archivo existente y lo reordena', async () => {
    const store1 = new ScoreStore(file);
    await store1.submit(input({ correct: 1 }));
    await store1.submit(input({ correct: 7 }));
    const store2 = new ScoreStore(file);
    const data = await store2.leaderboard();
    expect(data.boards['multiplicar:facil'].map((e) => e.correct)).toEqual([7, 1]);
  });

  it('un archivo corrupto no rompe el arranque', async () => {
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, '{ esto no es json', 'utf8');
    const store = new ScoreStore(file);
    const data = await store.leaderboard();
    expect(data.boards['multiplicar:facil']).toEqual([]);
  });
});
