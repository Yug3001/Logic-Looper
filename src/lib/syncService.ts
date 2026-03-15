/**
 * Logic Looper — Sync Service
 *
 * Smart sync rules:
 *  - Only syncs if: user is logged in AND has unsynced activity AND online
 *  - Batches all unsynced entries in a single POST
 *  - Server validates: date matches, score within bounds, time not unrealistic
 *  - On success: marks local records as synced
 *  - Registers online/offline listeners to auto-trigger
 */

import {
    buildSyncPayload,
    getUnsyncedActivity,
    markSynced,
    getMeta,
    setMeta,
} from './db';
import { scores as apiScores } from './apiClient';

const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 min cooldown

let syncInProgress = false;

// ─── Online/Offline Listeners ────────────────────────────────────────────────

let _syncCallback: (() => void) | null = null;

export function registerSyncListeners(onSync?: () => void): () => void {
    _syncCallback = onSync ?? null;

    const handleOnline = () => {
        console.log('[Sync] Connection restored — triggering sync');
        attemptSync();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
}

// ─── Core Sync Function ───────────────────────────────────────────────────────

export interface SyncResult {
    success: boolean;
    syncedCount: number;
    error?: string;
}

/**
 * Attempt to sync unsynced activity to server.
 * Safe to call frequently — guards against duplicate runs and cooldown period.
 */
export async function attemptSync(force = false): Promise<SyncResult> {
    if (syncInProgress) {
        return { success: false, syncedCount: 0, error: 'Sync already in progress' };
    }

    if (!navigator.onLine) {
        return { success: false, syncedCount: 0, error: 'Offline' };
    }

    // Cooldown check
    if (!force) {
        const lastSync = await getMeta<number>('lastSyncAt');
        if (lastSync && Date.now() - lastSync < MIN_SYNC_INTERVAL_MS) {
            return { success: false, syncedCount: 0, error: 'Cooldown active' };
        }
    }

    const unsynced = await getUnsyncedActivity();
    if (unsynced.length === 0) {
        return { success: true, syncedCount: 0 };
    }

    syncInProgress = true;

    try {
        const payload = await buildSyncPayload();

        // Use typed API client — automatically attaches Authorization header
        await apiScores.sync(payload.entries);

        const dates = unsynced.map(a => a.date);
        await markSynced(dates);
        await setMeta('lastSyncAt', Date.now());

        console.log(`[Sync] Synced ${dates.length} entries`);
        _syncCallback?.();

        return { success: true, syncedCount: dates.length };
    } catch (err: any) {
        console.warn('[Sync] Failed:', err.message);
        return { success: false, syncedCount: 0, error: err.message };
    } finally {
        syncInProgress = false;
    }
}

// ─── Score Validation (Client pre-check before accepting a solve) ──────────────

export interface ValidationResult {
    valid: boolean;
    reason?: string;
}

/**
 * Validates a submitted score client-side before storing.
 * Server performs the same checks on sync.
 */
export function validateScore(params: {
    score: number;
    timeTaken: number;
    difficulty: number;
}): ValidationResult {
    const { score, timeTaken, difficulty } = params;

    // Max possible: 1000 base + 400 time bonus = 1400
    if (score < 0 || score > 1400) {
        return { valid: false, reason: 'Score out of range (0–1400)' };
    }

    const MIN_TIME: Record<number, number> = { 0: 15, 1: 20, 2: 30, 3: 45 };
    if (timeTaken < (MIN_TIME[difficulty] ?? 15)) {
        return { valid: false, reason: 'Time unrealistically fast' };
    }

    if (timeTaken > 3600) {
        return { valid: false, reason: 'Time exceeds 1 hour limit' };
    }

    return { valid: true };
}

// ─── Device Date Tamper Detection ─────────────────────────────────────────────

/**
 * Validates local date hasn't been manipulated backwards.
 * Stores a high-water-mark timestamp; if local time goes behind it, it's suspicious.
 */
export async function validateLocalDate(): Promise<{ valid: boolean; reason?: string }> {
    const now = Date.now();
    const storedMs = await getMeta<number>('lastSeenTimestampMs');

    if (storedMs && now < storedMs - 60_000) {
        // Device clock went back more than 1 minute — likely manipulation
        return {
            valid: false,
            reason: `Device clock appears to have been set back (delta: ${Math.round((storedMs - now) / 1000)}s). Please correct your device time.`,
        };
    }

    // Update high-water mark
    await setMeta('lastSeenTimestampMs', now);
    return { valid: true };
}
