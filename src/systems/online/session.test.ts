import { describe, expect, it } from 'vitest';
import { isRoomCode } from './protocol';
import { roomCodeFromUrl, roomLink } from './session';

describe('roomCodeFromUrl', () => {
  it('lee el código del enlace compartido', () => {
    expect(roomCodeFromUrl('?sala=AB2CD')).toBe('AB2CD');
    expect(roomCodeFromUrl('?sala=ab2cd')).toBe('AB2CD');
  });

  it('ignora códigos con formato inválido', () => {
    expect(roomCodeFromUrl('?sala=AB2')).toBeNull();
    expect(roomCodeFromUrl('?sala=AB2CDE')).toBeNull();
    expect(roomCodeFromUrl('?sala=AB0CD')).toBeNull();
    expect(roomCodeFromUrl('?level=facil')).toBeNull();
  });
});

describe('roomLink', () => {
  it('arma el enlace sobre el origen actual', () => {
    expect(roomLink('AB2CD', 'http://localhost:8787', '/')).toBe('http://localhost:8787/?sala=AB2CD');
  });

  it('quita index.html para que el enlace quede limpio', () => {
    expect(roomLink('AB2CD', 'https://juego.ejemplo', '/index.html')).toBe('https://juego.ejemplo/?sala=AB2CD');
  });
});

describe('isRoomCode', () => {
  it('acepta solo el alfabeto sin caracteres ambiguos', () => {
    expect(isRoomCode('AB2CD')).toBe(true);
    expect(isRoomCode('AB1CD')).toBe(false);
    expect(isRoomCode('ABOCD')).toBe(false);
  });
});
