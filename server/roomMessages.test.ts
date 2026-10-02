import { describe, expect, it } from 'vitest';
import { parseClientMessage } from './roomMessages.js';
import { RoomError } from './roomTypes.js';

describe('parseClientMessage', () => {
  it('acepta un create válido y limpia el nombre', () => {
    const msg = parseClientMessage({ type: 'create', name: '  Ana   María  ', trainer: 'Misty', level: 'dificil', operation: 'dividir' });
    expect(msg).toEqual({ type: 'create', name: 'Ana María', trainer: 'misty', level: 'dificil', operation: 'dividir' });
  });

  it('acepta JSON en texto', () => {
    expect(parseClientMessage('{"type":"ping"}')).toEqual({ type: 'ping' });
  });

  it('rechaza nivel u operación inventados', () => {
    expect(() => parseClientMessage({ type: 'create', name: 'Ana', trainer: 'misty', level: 'imposible', operation: 'multiplicar' })).toThrowError(RoomError);
    expect(() => parseClientMessage({ type: 'create', name: 'Ana', trainer: 'misty', level: 'facil', operation: 'sumar' })).toThrowError(RoomError);
  });

  it('normaliza el código de sala y rechaza los que no tienen 5 caracteres', () => {
    expect(parseClientMessage({ type: 'join', code: ' ab2cd ', name: 'Ana', trainer: 'misty' })).toMatchObject({ code: 'AB2CD' });
    expect(() => parseClientMessage({ type: 'join', code: 'AB2', name: 'Ana', trainer: 'misty' })).toThrowError(RoomError);
  });

  it('descarta caracteres raros en el id de entrenador', () => {
    const msg = parseClientMessage({ type: 'join', code: 'AB2CD', name: 'Ana', trainer: '<script>ltsurge' });
    expect(msg).toMatchObject({ trainer: 'scriptltsurge' });
  });

  it('recorta contadores fuera de rango en lugar de confiar en el cliente', () => {
    expect(parseClientMessage({ type: 'progress', correct: 999999, waves: -4 })).toEqual({ type: 'progress', correct: 10000, waves: 0 });
    expect(parseClientMessage({ type: 'finish', correct: 7.9, waves: 2 })).toEqual({ type: 'finish', correct: 7, waves: 2 });
  });

  it('rechaza mensajes mal formados', () => {
    expect(() => parseClientMessage('no soy json')).toThrowError(RoomError);
    expect(() => parseClientMessage({ type: 'autodestruir' })).toThrowError(RoomError);
    expect(() => parseClientMessage({ type: 'progress', correct: 'muchos', waves: 1 })).toThrowError(RoomError);
    expect(() => parseClientMessage({ type: 'create', name: '   ', trainer: 'misty', level: 'facil', operation: 'multiplicar' })).toThrowError(RoomError);
  });
});
