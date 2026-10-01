import { describe, expect, it } from 'vitest';
import { compareRoomPlayers, RoomManager, roomView, type RoomPlayer } from './rooms.js';
import { MAX_ROOM_PLAYERS, RoomError } from './roomTypes.js';

/** Secuencia determinista para que los códigos y las semillas sean reproducibles. */
function fakeRandom(): () => number {
  let i = 0;
  return () => {
    i += 1;
    return (i * 0.6180339887) % 1;
  };
}

function manager(opts: { now?: () => number } = {}): RoomManager {
  return new RoomManager({ random: fakeRandom(), now: opts.now });
}

function host(rooms: RoomManager) {
  return rooms.create({ name: 'Ana', trainer: 'misty', level: 'normal', operation: 'multiplicar' });
}

describe('RoomManager', () => {
  it('crea una sala con código, semilla y el creador como anfitrión', () => {
    const rooms = manager();
    const { room, playerId } = host(rooms);
    expect(room.code).toMatch(/^[A-Z2-9]{5}$/);
    expect(room.state).toBe('lobby');
    expect(room.hostId).toBe(playerId);
    expect(room.seed).toBeGreaterThanOrEqual(0);
    expect(rooms.summary(room.code)?.players).toBe(1);
  });

  it('acepta el código en minúsculas y con espacios', () => {
    const rooms = manager();
    const { room } = host(rooms);
    const joined = rooms.join(`  ${room.code.toLowerCase()} `, { name: 'Beto', trainer: 'brock' });
    expect(joined.room.code).toBe(room.code);
    expect(joined.room.players.size).toBe(2);
  });

  it('rechaza una sala inexistente', () => {
    const rooms = manager();
    expect(() => rooms.join('ZZZZZ', { name: 'Beto', trainer: 'brock' })).toThrowError(RoomError);
  });

  it('admite 50 jugadores y rechaza el 51', () => {
    const rooms = manager();
    const { room } = host(rooms);
    for (let i = 1; i < MAX_ROOM_PLAYERS; i++) rooms.join(room.code, { name: `J${i}`, trainer: 'brock' });
    expect(room.players.size).toBe(MAX_ROOM_PLAYERS);
    expect(() => rooms.join(room.code, { name: 'tarde', trainer: 'brock' })).toThrowError(/50 jugadores/);
  });

  it('solo el anfitrión empieza la partida', () => {
    const rooms = manager();
    const { room, playerId } = host(rooms);
    const guest = rooms.join(room.code, { name: 'Beto', trainer: 'brock' });
    expect(() => rooms.start(room.code, guest.playerId)).toThrowError(/solo quien creó la sala/);
    expect(rooms.start(room.code, playerId).state).toBe('playing');
  });

  it('no se puede entrar a una partida ya empezada', () => {
    const rooms = manager();
    const { room, playerId } = host(rooms);
    rooms.start(room.code, playerId);
    expect(() => rooms.join(room.code, { name: 'tarde', trainer: 'brock' })).toThrowError(/ya empezó/);
  });

  it('el progreso nunca retrocede y se ignora fuera de partida', () => {
    const rooms = manager();
    const { room, playerId } = host(rooms);
    rooms.progress(room.code, playerId, 5, 1);
    expect(room.players.get(playerId)?.correct).toBe(0);

    rooms.start(room.code, playerId);
    rooms.progress(room.code, playerId, 7, 2);
    rooms.progress(room.code, playerId, 3, 0);
    const player = room.players.get(playerId);
    expect(player?.correct).toBe(7);
    expect(player?.waves).toBe(2);
  });

  it('la sala termina cuando todos acaban', () => {
    const rooms = manager();
    const { room, playerId } = host(rooms);
    const guest = rooms.join(room.code, { name: 'Beto', trainer: 'brock' });
    rooms.start(room.code, playerId);

    rooms.finish(room.code, playerId, 12, 3);
    expect(room.state).toBe('playing');
    rooms.finish(room.code, guest.playerId, 9, 2);
    expect(room.state).toBe('ended');

    const view = roomView(room);
    expect(view.players.map((p) => p.name)).toEqual(['Ana', 'Beto']);
  });

  it('salir en el lobby borra al jugador; salir en partida congela su puntaje', () => {
    const rooms = manager();
    const { room, playerId } = host(rooms);
    const guest = rooms.join(room.code, { name: 'Beto', trainer: 'brock' });

    rooms.leave(room.code, guest.playerId);
    expect(room.players.size).toBe(1);

    const otro = rooms.join(room.code, { name: 'Caro', trainer: 'erika' });
    rooms.start(room.code, playerId);
    rooms.progress(room.code, otro.playerId, 4, 1);
    rooms.leave(room.code, otro.playerId);

    const salido = room.players.get(otro.playerId);
    expect(salido?.correct).toBe(4);
    expect(salido?.finished).toBe(true);
    expect(salido?.connected).toBe(false);
  });

  it('si el anfitrión se va, otro jugador toma el relevo', () => {
    const rooms = manager();
    const { room, playerId } = host(rooms);
    const guest = rooms.join(room.code, { name: 'Beto', trainer: 'brock' });
    rooms.leave(room.code, playerId);
    expect(room.hostId).toBe(guest.playerId);
  });

  it('la sala desaparece cuando se va el último jugador', () => {
    const rooms = manager();
    const { room, playerId } = host(rooms);
    expect(rooms.leave(room.code, playerId)).toBeNull();
    expect(rooms.get(room.code)).toBeUndefined();
    expect(rooms.size).toBe(0);
  });

  it('una nueva ronda reinicia marcadores, cambia la semilla y suelta a los desconectados', () => {
    const rooms = manager();
    const { room, playerId } = host(rooms);
    const guest = rooms.join(room.code, { name: 'Beto', trainer: 'brock' });
    rooms.start(room.code, playerId);
    const seed = room.seed;
    rooms.finish(room.code, playerId, 10, 2);
    rooms.leave(room.code, guest.playerId);

    rooms.again(room.code, playerId);
    expect(room.state).toBe('lobby');
    expect(room.seed).not.toBe(seed);
    expect(room.players.size).toBe(1);
    expect(room.players.get(playerId)?.correct).toBe(0);
  });

  it('no se puede repetir mientras la partida sigue', () => {
    const rooms = manager();
    const { room, playerId } = host(rooms);
    rooms.start(room.code, playerId);
    expect(() => rooms.again(room.code, playerId)).toThrowError(/en curso/);
  });

  it('respeta el tope de salas simultáneas', () => {
    const rooms = new RoomManager({ random: fakeRandom(), maxRooms: 2 });
    host(rooms);
    host(rooms);
    expect(() => host(rooms)).toThrowError(/demasiadas salas/);
  });

  it('prune descarta salas inactivas y vacías', () => {
    let clock = 1_000;
    const rooms = new RoomManager({ random: fakeRandom(), now: () => clock });
    const { room, playerId } = host(rooms);
    rooms.start(room.code, playerId);
    expect(rooms.prune(10_000)).toBe(0);

    clock += 60_000;
    expect(rooms.prune(10_000)).toBe(1);
    expect(rooms.size).toBe(0);
  });
});

describe('compareRoomPlayers', () => {
  const base: RoomPlayer = {
    id: 'a',
    name: 'A',
    trainer: 'brock',
    correct: 0,
    waves: 0,
    finished: false,
    connected: true,
    joinedAt: 0,
  };

  it('ordena por aciertos, luego oleadas y luego por antigüedad', () => {
    const players: RoomPlayer[] = [
      { ...base, id: 'c', correct: 5, waves: 1, joinedAt: 30 },
      { ...base, id: 'a', correct: 9, waves: 2, joinedAt: 10 },
      { ...base, id: 'b', correct: 5, waves: 2, joinedAt: 20 },
    ];
    expect(players.sort(compareRoomPlayers).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
});
