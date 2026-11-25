import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  MultiplayerPlayer,
  MultiplayerRoom,
  ServerToClientEvents,
} from '../src/game/multiplayerProtocol.ts';

type PlayerState = MultiplayerPlayer;

interface RoomState {
  code: string;
  hostSocketId: string;
  status: MultiplayerRoom['status'];
  level: number | null;
  startedAt: number | null;
  players: Map<string, PlayerState>;
  winnerId: string | null;
}

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type GameServer = Server<ClientToServerEvents, ServerToClientEvents>;
const rooms = new Map<string, RoomState>();
const socketRooms = new Map<string, string>();
const attachedServers = new WeakSet<HttpServer>();
const ROOM_CODE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function createRoomCode(): string {
  let code = '';
  do {
    code = Array.from({ length: 6 }, () =>
      ROOM_CODE_CHARACTERS[Math.floor(Math.random() * ROOM_CODE_CHARACTERS.length)],
    ).join('');
  } while (rooms.has(code));
  return code;
}

function sanitizeName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const cleaned = name.trim().replace(/\s+/g, ' ').slice(0, 16);
  return cleaned.length > 0 ? cleaned : null;
}

function toSnapshot(room: RoomState): MultiplayerRoom {
  return {
    code: room.code,
    status: room.status,
    level: room.level,
    startedAt: room.startedAt,
    players: Array.from(room.players.values(), ({ id, name, score, done }) => ({
      id,
      name,
      score,
      done,
    })),
    winnerId: room.winnerId,
  };
}

function publishRoom(io: GameServer, room: RoomState): void {
  io.to(room.code).emit('room:update', toSnapshot(room));
}

function removePlayer(io: GameServer, socketId: string): void {
  const code = socketRooms.get(socketId);
  if (!code) return;

  const room = rooms.get(code);
  socketRooms.delete(socketId);
  if (!room) return;

  room.players.delete(socketId);
  if (room.players.size === 0) {
    rooms.delete(code);
    return;
  }

  if (room.status === 'finished') return;

  if (room.hostSocketId === socketId) {
    const nextHostId = room.players.keys().next().value;
    if (nextHostId) room.hostSocketId = nextHostId;
  }
  room.status = 'waiting';
  room.level = null;
  room.startedAt = null;
  room.winnerId = null;
  for (const player of room.players.values()) {
    player.score = 0;
    player.done = false;
  }
  publishRoom(io, room);
}

export function attachMultiplayerServer(httpServer: HttpServer): void {
  if (attachedServers.has(httpServer)) return;
  attachedServers.add(httpServer);

  const io: GameServer = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer);

  io.on('connection', (socket: GameSocket) => {
    const leaveRoom = () => {
      const code = socketRooms.get(socket.id);
      if (code) void socket.leave(code);
      removePlayer(io, socket.id);
    };

    socket.on('room:create', (input, callback) => {
      if (typeof callback !== 'function') return;
      const safeName = sanitizeName(input?.name);
      if (!safeName) {
        callback({ ok: false, error: 'Masukkan nama pemain terlebih dahulu.' });
        return;
      }
      if (socketRooms.has(socket.id)) {
        callback({ ok: false, error: 'Keluar dari room saat ini sebelum membuat room baru.' });
        return;
      }

      const code = createRoomCode();
      const room: RoomState = {
        code,
        hostSocketId: socket.id,
        status: 'waiting',
        level: null,
        startedAt: null,
        players: new Map([[socket.id, {
          id: socket.id,
          name: safeName,
          score: 0,
          done: false,
        }]]),
        winnerId: null,
      };
      rooms.set(code, room);
      socketRooms.set(socket.id, code);
      void socket.join(code);
      callback({ ok: true, data: { room: toSnapshot(room), playerId: socket.id } });
      publishRoom(io, room);
    });

    socket.on('room:join', (input, callback) => {
      if (typeof callback !== 'function') return;
      const safeName = sanitizeName(input?.name);
      const safeCode = typeof input?.code === 'string' ? input.code.trim().toUpperCase() : '';
      const room = rooms.get(safeCode);
      if (!safeName) {
        callback({ ok: false, error: 'Masukkan nama pemain terlebih dahulu.' });
        return;
      }
      if (socketRooms.has(socket.id)) {
        callback({ ok: false, error: 'Keluar dari room saat ini sebelum bergabung ke room lain.' });
        return;
      }
      if (!room || room.status !== 'waiting') {
        callback({ ok: false, error: 'Room tidak ditemukan atau pertandingan sudah dimulai.' });
        return;
      }
      if (room.players.size >= 2) {
        callback({ ok: false, error: 'Room sudah penuh.' });
        return;
      }

      room.players.set(socket.id, {
        id: socket.id,
        name: safeName,
        score: 0,
        done: false,
      });
      socketRooms.set(socket.id, safeCode);
      void socket.join(safeCode);
      callback({ ok: true, data: { room: toSnapshot(room), playerId: socket.id } });
      publishRoom(io, room);
    });

    socket.on('room:start', (input, callback) => {
      if (typeof callback !== 'function') return;
      const code = socketRooms.get(socket.id);
      const room = code ? rooms.get(code) : undefined;
      if (!room || room.hostSocketId !== socket.id) {
        callback({ ok: false, error: 'Hanya pembuat room yang dapat memulai pertandingan.' });
        return;
      }
      if (room.status !== 'waiting' || room.players.size !== 2) {
        callback({ ok: false, error: 'Butuh dua pemain di room sebelum pertandingan dimulai.' });
        return;
      }
      const level = input?.level;
      if (!Number.isInteger(level) || level < 1 || level > 5) {
        callback({ ok: false, error: 'Level pertandingan tidak valid.' });
        return;
      }

      room.status = 'playing';
      room.level = level;
      room.startedAt = Date.now() + 3000;
      room.winnerId = null;
      for (const player of room.players.values()) {
        player.score = 0;
        player.done = false;
      }
      publishRoom(io, room);
      io.to(room.code).emit('match:starting', { level, startedAt: room.startedAt });
      callback({ ok: true, data: null });
    });

    socket.on('game:score', (input) => {
      const code = socketRooms.get(socket.id);
      const room = code ? rooms.get(code) : undefined;
      const player = room?.players.get(socket.id);
      if (!room || room.status !== 'playing' || !player || player.done) return;
      const score = input?.score;
      if (!Number.isSafeInteger(score) || score < 0 || score > 10_000_000) return;
      if (score < player.score) return;
      player.score = score;
      publishRoom(io, room);
    });

    socket.on('game:finish', (input) => {
      const code = socketRooms.get(socket.id);
      const room = code ? rooms.get(code) : undefined;
      const player = room?.players.get(socket.id);
      if (!room || room.status !== 'playing' || !player || player.done) return;
      const score = input?.score;
      if (!Number.isSafeInteger(score) || score < 0 || score > 10_000_000) return;
      if (score < player.score) return;
      player.score = score;
      player.done = true;

      if (Array.from(room.players.values()).every((currentPlayer) => currentPlayer.done)) {
        room.status = 'finished';
        const [first, second] = Array.from(room.players.values());
        room.winnerId = first.score === second.score
          ? null
          : first.score > second.score
            ? first.id
            : second.id;
      }
      publishRoom(io, room);
    });

    socket.on('room:leave', leaveRoom);
    socket.on('disconnect', leaveRoom);
  });
}
