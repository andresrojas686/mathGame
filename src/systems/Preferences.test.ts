import { describe, expect, it } from 'vitest';
import { sanitizeName } from './Preferences';

describe('sanitizeName', () => {
  it('recorta espacios sobrantes y colapsa los internos', () => {
    expect(sanitizeName('  Sofía   Pérez ')).toBe('Sofía Pérez');
  });
  it('limita a 12 caracteres', () => {
    expect(sanitizeName('abcdefghijklmnop')).toBe('abcdefghijkl');
  });
  it('vacío o solo espacios queda vacío', () => {
    expect(sanitizeName('   ')).toBe('');
  });
});
