import { describe, expect, it } from 'vitest';
import { censor } from './badwords';
import { parseScoreInput, sanitizeName, ValidationError } from './validation';

describe('censor', () => {
  it('sustituye palabras vetadas por asteriscos, con o sin tildes y mayúsculas', () => {
    expect(censor('Sofía')).toBe('Sofía');
    expect(censor('PuTo Pepe')).toBe('**** Pepe');
    expect(censor('cabrón')).toBe('******');
  });
});

describe('sanitizeName', () => {
  it('recorta, colapsa espacios y limita a 12', () => {
    expect(sanitizeName('  Ana   María  López ')).toBe('Ana María Ló');
  });
  it('rechaza vacío o no texto', () => {
    expect(() => sanitizeName('   ')).toThrow(ValidationError);
    expect(() => sanitizeName(42)).toThrow(ValidationError);
  });
});

describe('parseScoreInput', () => {
  const ok = { name: 'Sofía', level: 'normal', operation: 'multiplicar', correct: 12, waves: 2 };

  it('acepta un cuerpo válido', () => {
    expect(parseScoreInput(ok)).toEqual(ok);
  });
  it('operation por defecto es multiplicar', () => {
    const { operation: _omit, ...noOp } = ok;
    expect(parseScoreInput(noOp).operation).toBe('multiplicar');
  });
  it.each([
    ['level inválido', { ...ok, level: 'extremo' }],
    ['operation inválida', { ...ok, operation: 'restar' }],
    ['correct negativo', { ...ok, correct: -1 }],
    ['correct decimal', { ...ok, correct: 1.5 }],
    ['correct texto', { ...ok, correct: '12' }],
    ['correct enorme', { ...ok, correct: 10001 }],
    ['waves ausente', { name: 'a', level: 'facil', correct: 1 }],
    ['cuerpo nulo', null],
  ])('rechaza %s', (_label, body) => {
    expect(() => parseScoreInput(body)).toThrow(ValidationError);
  });
});
