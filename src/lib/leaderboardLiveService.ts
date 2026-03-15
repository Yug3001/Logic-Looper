/**
 * Leaderboard Live Service
 * Connects to the /leaderboard-live Socket.io namespace to receive
 * real-time updates of active battles and solo sessions.
 */

import { io, Socket } from 'socket.io-client';
import type { RoomSnapshot } from './lbTypes';

export type { RoomSnapshot };

export interface LbSnapshot {
    rooms: RoomSnapshot[];
    ts: number;
}

export interface LbUpdateEvent {
    type: 'completion' | 'player_left' | 'new_room';
    roomId: string;
    player?: any;
    userId?: string;
    allFinished?: boolean;
    ts: number;
}

type SnapshotHandler = (data: LbSnapshot) => void;
type UpdateHandler = (data: LbUpdateEvent) => void;

class LeaderboardLiveService {
    private socket: Socket | null = null;
    private _connected = false;
    private snapshotHandlers = new Set<SnapshotHandler>();
    private updateHandlers = new Set<UpdateHandler>();

    get connected() { return this._connected; }

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.socket?.connected) { resolve(); return; }

            const baseUrl = (import.meta as any).env?.VITE_API_BASE_URL || '';
            this.socket = io(`${baseUrl}/leaderboard-live`, {
                transports: ['websocket', 'polling'],
                reconnectionAttempts: 10,
                reconnectionDelay: 2000,
                timeout: 10000,
            });

            this.socket.on('connect', () => {
                this._connected = true;
                resolve();
            });

            this.socket.on('connect_error', (err) => {
                this._connected = false;
                // Don't reject — the leaderboard page should degrade gracefully
                resolve();
            });

            this.socket.on('disconnect', () => {
                this._connected = false;
            });

            this.socket.on('lb:snapshot', (data: LbSnapshot) => {
                this.snapshotHandlers.forEach(h => h(data));
            });

            this.socket.on('lb:update', (data: LbUpdateEvent) => {
                this.updateHandlers.forEach(h => h(data));
            });
        });
    }

    onSnapshot(handler: SnapshotHandler) {
        this.snapshotHandlers.add(handler);
        // If already connected, send a refresh request
        if (this.socket?.connected) {
            this.socket.emit('lb:request_refresh');
        }
        return () => this.snapshotHandlers.delete(handler);
    }

    onUpdate(handler: UpdateHandler) {
        this.updateHandlers.add(handler);
        return () => this.updateHandlers.delete(handler);
    }

    requestRefresh() {
        this.socket?.emit('lb:request_refresh');
    }

    destroy() {
        this.socket?.disconnect();
        this.socket = null;
        this._connected = false;
        this.snapshotHandlers.clear();
        this.updateHandlers.clear();
    }
}

// ─── Singleton (shared across tabs/views) ─────────────────────────────────────

let _lbInstance: LeaderboardLiveService | null = null;

export function getLbLiveService(): LeaderboardLiveService {
    if (!_lbInstance) _lbInstance = new LeaderboardLiveService();
    return _lbInstance;
}

export function destroyLbLiveService() {
    _lbInstance?.destroy();
    _lbInstance = null;
}
