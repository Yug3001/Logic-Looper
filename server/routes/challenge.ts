/**
 * Challenge WebSocket Room Manager + Live Leaderboard Broadcaster
 *
 * Challenge namespace (/challenge):
 *   challenge:joined, challenge:progress, challenge:completed, etc.
 *
 * Leaderboard namespace (/leaderboard-live):
 *   lb:snapshot   — Full live state (active battles + recent completes)
 *   lb:update     — Incremental update when a player scores / battle state changes
 *
 * REST helper:
 *   getRoomsSnapshot() — used by GET /api/leaderboard/live
 */

import { Server as SocketServer, Socket, Namespace } from 'socket.io';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlayerState {
    socketId: string;
    userId: string;
    name: string;
    avatar: string | null;
    progress: number;
    hintsUsed: number;
    timeTaken: number;
    score: number | null;
    finished: boolean;
    connectedAt: number;
}

export interface ChallengeRoom {
    id: string;
    puzzleDate: string;
    puzzleType: string;
    difficulty: number;
    players: Map<string, PlayerState>;
    createdAt: number;
    startedAt: number | null;
    mode: 'challenge' | 'solo';
}

// ─── In-memory rooms ──────────────────────────────────────────────────────────

const rooms = new Map<string, ChallengeRoom>();

// Clean stale rooms every 15 minutes (>30 min old)
setInterval(() => {
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [id, room] of rooms) {
        if (room.createdAt < cutoff) rooms.delete(id);
    }
}, 15 * 60 * 1000);

// ─── Public snapshot (for REST route) ─────────────────────────────────────────

export interface RoomSnapshot {
    id: string;
    puzzleType: string;
    difficulty: number;
    mode: 'challenge' | 'solo';
    startedAt: number | null;
    players: ReturnType<typeof serializePlayer>[];
    allFinished: boolean;
}

export function getRoomsSnapshot(): RoomSnapshot[] {
    return [...rooms.values()].map(room => {
        const playerList = [...room.players.values()];
        return {
            id: room.id,
            puzzleType: room.puzzleType,
            difficulty: room.difficulty,
            mode: room.mode,
            startedAt: room.startedAt,
            players: playerList.map(serializePlayer),
            allFinished: playerList.length > 0 && playerList.every(p => p.finished),
        };
    });
}

// ─── Leaderboard namespace ─────────────────────────────────────────────────────

let _lbNs: Namespace | null = null;

/** Broadcast fresh live snapshot to all leaderboard watchers */
function broadcastLiveSnapshot() {
    if (!_lbNs) return;
    _lbNs.emit('lb:snapshot', {
        rooms: getRoomsSnapshot(),
        ts: Date.now(),
    });
}

// ─── Socket.io Setup ──────────────────────────────────────────────────────────

export function attachChallengeSocket(io: SocketServer) {
    // ── Leaderboard live namespace ──────────────────────────────────────────
    _lbNs = io.of('/leaderboard-live');
    _lbNs.on('connection', (socket: Socket) => {
        // Send full snapshot immediately on connect
        socket.emit('lb:snapshot', {
            rooms: getRoomsSnapshot(),
            ts: Date.now(),
        });
        // lb:request_refresh — client can ask for a fresh snapshot
        socket.on('lb:request_refresh', () => {
            socket.emit('lb:snapshot', { rooms: getRoomsSnapshot(), ts: Date.now() });
        });
    });

    // ── Challenge namespace ─────────────────────────────────────────────────
    const ns = io.of('/challenge');

    ns.on('connection', (socket: Socket) => {
        let currentRoomId: string | null = null;
        let currentUserId: string | null = null;

        // ── Join or create room ──
        socket.on('challenge:join', (payload: {
            roomId: string;
            userId: string;
            name: string;
            avatar: string | null;
            puzzleDate: string;
            puzzleType: string;
            difficulty: number;
            mode?: 'challenge' | 'solo';
        }) => {
            const { roomId, userId, name, avatar, puzzleDate, puzzleType, difficulty, mode = 'challenge' } = payload;

            if (!roomId || !userId || !name) {
                socket.emit('challenge:error', { message: 'Missing required fields' });
                return;
            }

            let room = rooms.get(roomId);
            if (!room) {
                room = {
                    id: roomId,
                    puzzleDate,
                    puzzleType,
                    difficulty,
                    mode,
                    players: new Map(),
                    createdAt: Date.now(),
                    startedAt: null,
                };
                rooms.set(roomId, room);
            }

            if (room.players.size >= 2 && !room.players.has(socket.id)) {
                socket.emit('challenge:error', { message: 'Room is full (max 2 players)' });
                return;
            }

            const player: PlayerState = {
                socketId: socket.id,
                userId,
                name,
                avatar,
                progress: 0,
                hintsUsed: 0,
                timeTaken: 0,
                score: null,
                finished: false,
                connectedAt: Date.now(),
            };
            room.players.set(socket.id, player);
            socket.join(roomId);
            currentRoomId = roomId;
            currentUserId = userId;

            const playerList = [...room.players.values()];

            if (room.players.size === 1) {
                socket.emit('challenge:ready', {
                    roomId,
                    player: serializePlayer(player),
                    message: 'Waiting for opponent to join…',
                });
                broadcastLiveSnapshot();
            } else {
                room.startedAt = Date.now();
                const startPayload = {
                    roomId,
                    players: playerList.map(serializePlayer),
                    startedAt: room.startedAt,
                    puzzleDate: room.puzzleDate,
                    puzzleType: room.puzzleType,
                    difficulty: room.difficulty,
                };
                ns.to(roomId).emit('challenge:joined', startPayload);
                broadcastLiveSnapshot();
            }
        });

        // ── Progress update ──
        socket.on('challenge:progress', (payload: {
            progress: number;
            hintsUsed: number;
            timeTaken: number;
        }) => {
            if (!currentRoomId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;
            const player = room.players.get(socket.id);
            if (!player) return;

            player.progress = Math.min(100, Math.max(0, payload.progress));
            player.hintsUsed = payload.hintsUsed;
            player.timeTaken = payload.timeTaken;

            socket.to(currentRoomId).emit('challenge:progress', {
                userId: player.userId,
                socketId: socket.id,
                progress: player.progress,
                hintsUsed: player.hintsUsed,
                timeTaken: player.timeTaken,
            });

            // Broadcast to LB watchers every ~5s (throttled by client rate)
            broadcastLiveSnapshot();
        });

        // ── Completion ──
        socket.on('challenge:complete', (payload: {
            score: number;
            timeTaken: number;
            hintsUsed: number;
            correct: boolean;
        }) => {
            if (!currentRoomId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;
            const player = room.players.get(socket.id);
            if (!player) return;

            player.finished = true;
            player.score = payload.score;
            player.timeTaken = payload.timeTaken;
            player.hintsUsed = payload.hintsUsed;
            player.progress = 100;

            const allPlayers = [...room.players.values()];
            const allFinished = allPlayers.every(p => p.finished);

            ns.to(currentRoomId).emit('challenge:completed', {
                finisher: serializePlayer(player),
                correct: payload.correct,
                allFinished,
                players: allPlayers.map(serializePlayer),
            });

            // Broadcast LB update
            broadcastLiveSnapshot();

            // Also push a score update event for LB watchers
            _lbNs?.emit('lb:update', {
                type: 'completion',
                roomId: currentRoomId,
                player: serializePlayer(player),
                allFinished,
                ts: Date.now(),
            });
        });

        // ── Disconnect ──
        socket.on('disconnect', () => {
            if (!currentRoomId) return;
            const room = rooms.get(currentRoomId);
            if (!room) return;

            room.players.delete(socket.id);
            socket.to(currentRoomId).emit('challenge:opponent_left', {
                userId: currentUserId,
            });

            // Notify leaderboard
            _lbNs?.emit('lb:update', {
                type: 'player_left',
                roomId: currentRoomId,
                userId: currentUserId,
                ts: Date.now(),
            });

            if (room.players.size === 0) {
                rooms.delete(currentRoomId);
            }
            broadcastLiveSnapshot();
        });
    });

    return ns;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function serializePlayer(p: PlayerState) {
    return {
        socketId: p.socketId,
        userId: p.userId,
        name: p.name,
        avatar: p.avatar,
        progress: p.progress,
        hintsUsed: p.hintsUsed,
        timeTaken: p.timeTaken,
        score: p.score,
        finished: p.finished,
    };
}
