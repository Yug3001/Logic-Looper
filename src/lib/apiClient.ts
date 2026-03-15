/// <reference types="vite/client" />

/**
 * API Client — typed fetch wrapper for all backend endpoints.
 * Automatically attaches JWT, handles errors uniformly.
 */

const BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? '';

// ─── Token Management ─────────────────────────────────────────────────────────

let _token: string | null = localStorage.getItem('ll_token');

export function setToken(token: string | null) {
    _token = token;
    if (token) localStorage.setItem('ll_token', token);
    else localStorage.removeItem('ll_token');
}

export function getToken(): string | null {
    return _token;
}

// ─── Fetch Wrapper ────────────────────────────────────────────────────────────

async function request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
): Promise<T> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (_token) headers['Authorization'] = `Bearer ${_token}`;

    const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
    }

    return res.json();
}

// ─── Auth Endpoints ───────────────────────────────────────────────────────────

export interface UserProfile {
    id: string;
    email: string | null;
    name: string | null;
    avatar: string | null;
    isGuest?: boolean;
    streakCount: number;
    totalPoints: number;
    stats?: {
        puzzlesSolved: number;
        avgSolveTime: number;
        bestStreak: number;
    };
}

export interface AuthResponse {
    token: string;
    user: UserProfile;
}

export const auth = {
    loginWithGoogle: (idToken: string) =>
        request<AuthResponse>('POST', '/api/auth/google', { idToken }),

    loginAsGuest: () =>
        request<AuthResponse>('POST', '/api/auth/guest'),

    login: (email: string, password: string) =>
        request<AuthResponse>('POST', '/api/auth/login', { email, password }),

    register: (email: string, password: string, name: string) =>
        request<AuthResponse>('POST', '/api/auth/register', { email, password, name }),

    me: () =>
        request<UserProfile>('GET', '/api/auth/me'),

    logout: () =>
        request<{ message: string }>('POST', '/api/auth/logout'),
};

// ─── Score Sync ───────────────────────────────────────────────────────────────

export interface SyncEntry {
    date: string;
    score: number;
    timeTaken: number;
    difficulty: number;
    puzzleType?: string;
}

export interface SyncResponse {
    synced: number;
    skipped: number;
    errors: string[];
}

export const scores = {
    sync: (entries: SyncEntry[]) =>
        request<SyncResponse>('POST', '/api/sync/daily-scores', { entries }),
};

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
    rank: number;
    userId: string;
    name: string;
    avatar: string | null;
    totalPoints: number;
    streakCount: number;
    puzzlesSolved: number;
}

export interface LeaderboardResponse {
    leaderboard: LeaderboardEntry[];
    updatedAt?: string;
    date?: string;
}

export const leaderboard = {
    global: () =>
        request<LeaderboardResponse>('GET', '/api/leaderboard/global'),

    daily: () =>
        request<LeaderboardResponse>('GET', '/api/leaderboard/daily'),

    rank: (userId: string) =>
        request<{ rank: number; totalPoints: number }>('GET', `/api/leaderboard/rank/${userId}`),
};

// ─── Health ───────────────────────────────────────────────────────────────────

export const health = {
    check: () =>
        request<{ status: string; version: string }>('GET', '/api/health'),
};
