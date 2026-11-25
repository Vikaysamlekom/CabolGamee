export interface MultiplayerPlayer {
  id: string;
  name: string;
  score: number;
  done: boolean;
}

export interface MultiplayerRoom {
  code: string;
  status: 'waiting' | 'playing' | 'finished';
  level: number | null;
  startedAt: number | null;
  players: MultiplayerPlayer[];
  winnerId: string | null;
}

export type MultiplayerResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface ClientToServerEvents {
  'room:create': (
    input: { name: string },
    callback: (response: MultiplayerResponse<{ room: MultiplayerRoom; playerId: string }>) => void,
  ) => void;
  'room:join': (
    input: { name: string; code: string },
    callback: (response: MultiplayerResponse<{ room: MultiplayerRoom; playerId: string }>) => void,
  ) => void;
  'room:start': (
    input: { level: number },
    callback: (response: MultiplayerResponse<null>) => void,
  ) => void;
  'room:leave': () => void;
  'game:score': (input: { score: number }) => void;
  'game:finish': (input: { score: number }) => void;
}

export interface ServerToClientEvents {
  'room:update': (room: MultiplayerRoom) => void;
  'match:starting': (input: { level: number; startedAt: number }) => void;
}
