/**
 * Challenge Service — Socket.io client for real-time head-to-head puzzle races.
 *
 * Usage:
 *   const svc = getChallengeService();
 *   svc.joinRoom({ roomId, userId, name, avatar, puzzleDate, … });
 *   svc.emitProgress({ progress, hintsUsed, timeTaken });
 *   svc.emitComplete({ score, timeTaken, hintsUsed, correct });
 *   svc.onEvent('challenge:joined', handler);
 *   svc.destroy(); // cleanup on unmount
 */

import { io, Socket } from 'socket.io-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlayerSnapshot {
    socketId: string;
    userId: string;
    name: string;
    avatar: string | null;
    progress: number;
    hintsUsed: number;
    timeTaken: number;
    score: number | null;
    finished: boolean;
}

export type ChallengeEvent =
    | 'challenge:ready'
    | 'challenge:joined'
    | 'challenge:progress'
    | 'challenge:completed'
    | 'challenge:opponent_left'
    | 'challenge:error';

export type ChallengeEventMap = {
    'challenge:ready': { roomId: string; player: PlayerSnapshot; message: string };
    'challenge:joined': {
        roomId: string;
        players: PlayerSnapshot[];
        startedAt: number;
        puzzleDate: string;
        puzzleType: string;
        difficulty: number;
    };
    'challenge:progress': {
        userId: string;
        socketId: string;
        progress: number;
        hintsUsed: number;
        timeTaken: number;
    };
    'challenge:completed': {
        finisher: PlayerSnapshot;
        correct: boolean;
        allFinished: boolean;
        players: PlayerSnapshot[];
    };
    'challenge:opponent_left': { userId: string };
    'challenge:error': { message: string };
};

export interface JoinPayload {
    roomId: string;
    userId: string;
    name: string;
    avatar: string | null;
    puzzleDate: string;
    puzzleType: string;
    difficulty: number;
}

// ─── Service Class ────────────────────────────────────────────────────────────

class ChallengeService {
    private socket: Socket | null = null;
    private _connected = false;

    get connected() { return this._connected; }

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.socket?.connected) { resolve(); return; }

            // Connect to the /challenge namespace
            // In dev, Vite proxy handles the connection to localhost:3001
            const baseUrl = (import.meta as any).env?.VITE_API_BASE_URL || '';
            this.socket = io(`${baseUrl}/challenge`, {
                transports: ['websocket', 'polling'],
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                timeout: 10000,
            });

            this.socket.on('connect', () => {
                this._connected = true;
                resolve();
            });

            this.socket.on('connect_error', (err) => {
                this._connected = false;
                reject(new Error(`WebSocket connection failed: ${err.message}`));
            });

            this.socket.on('disconnect', () => {
                this._connected = false;
            });
        });
    }

    async joinRoom(payload: JoinPayload): Promise<void> {
        if (!this.socket?.connected) await this.connect();
        this.socket!.emit('challenge:join', payload);
    }

    emitProgress(payload: { progress: number; hintsUsed: number; timeTaken: number }) {
        this.socket?.emit('challenge:progress', payload);
    }

    emitComplete(payload: { score: number; timeTaken: number; hintsUsed: number; correct: boolean }) {
        this.socket?.emit('challenge:complete', payload);
    }

    onEvent<E extends ChallengeEvent>(event: E, handler: (data: ChallengeEventMap[E]) => void) {
        this.socket?.on(event as string, handler as any);
    }

    offEvent<E extends ChallengeEvent>(event: E, handler?: (data: ChallengeEventMap[E]) => void) {
        this.socket?.off(event as string, handler as any);
    }

    destroy() {
        this.socket?.disconnect();
        this.socket = null;
        this._connected = false;
    }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

// One service instance per challenge session (created fresh per ChallengePanel mount)
let _instance: ChallengeService | null = null;

export function getChallengeService(): ChallengeService {
    if (!_instance) _instance = new ChallengeService();
    return _instance;
}

export function destroyChallengeService() {
    _instance?.destroy();
    _instance = null;
}

// ─── Room ID Helpers ──────────────────────────────────────────────────────────

/** Generate a new random challenge room ID */
export function generateRoomId(): string {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Build a shareable challenge URL */
export function buildChallengeUrl(roomId: string, puzzleDate: string): string {
    const url = new URL(window.location.href);
    url.searchParams.set('challenge', roomId);
    url.searchParams.set('date', puzzleDate);
    return url.toString();
}

/** Parse challenge params from the current URL */
export function parseChallengeUrl(): { roomId: string; date: string } | null {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('challenge');
    const date = params.get('date');
    if (roomId && date) return { roomId, date };
    return null;
}
