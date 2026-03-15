/**
 * Logic Looper — IndexedDB Engine
 * Uses `idb` (lightweight IDBDatabase wrapper).
 * Stores all puzzle activity client-side; server only receives aggregated sync payloads.
 */

import { openDB } from 'idb';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Difficulty = 0 | 1 | 2 | 3; // easy | medium | hard | expert

export interface DailyActivity {
    date: string;          // "YYYY-MM-DD" — primary key
    solved: boolean;
    score: number;
    timeTaken: number;     // seconds
    difficulty: Difficulty;
    puzzleType: string;
    hintsUsed: number;
    synced: boolean;       // false = pending server sync
    completedAt: string | null;
}

export interface AchievementRecord {
    id: string;
    unlockedAt: string;
    notified: boolean;
}

export interface SyncQueueEntry {
    id?: number;
    date: string;
    score: number;
    timeTaken: number;
    difficulty: Difficulty;
    createdAt: string;
}

// ─── DB Singleton ──────────────────────────────────────────────────────────────

let dbPromise: ReturnType<typeof openDB> | null = null;

export function getDB() {
    if (!dbPromise) {
        dbPromise = openDB('logic-looper-db', 3, {
            upgrade(db, oldVersion) {
                if (oldVersion < 1) {
                    const activityStore = db.createObjectStore('dailyActivity', { keyPath: 'date' });
                    activityStore.createIndex('by-synced', 'synced');
                    activityStore.createIndex('by-solved', 'solved');
                    db.createObjectStore('achievements', { keyPath: 'id' });
                    db.createObjectStore('syncQueue', { autoIncrement: true });
                    db.createObjectStore('meta', { keyPath: 'key' });
                }
                if (oldVersion < 3) {
                    // Store in-progress puzzle answers for reload restore
                    db.createObjectStore('puzzleProgress', { keyPath: 'date' });
                }
            },
        });
    }
    return dbPromise;
}

// ─── Activity CRUD ─────────────────────────────────────────────────────────────

export async function saveActivity(activity: DailyActivity): Promise<void> {
    const db = await getDB();
    await db.put('dailyActivity', activity);
}

export async function getActivity(date: string): Promise<DailyActivity | undefined> {
    const db = await getDB();
    return db.get('dailyActivity', date);
}

export async function getAllActivity(): Promise<DailyActivity[]> {
    const db = await getDB();
    return db.getAll('dailyActivity');
}

export async function getUnsyncedActivity(): Promise<DailyActivity[]> {
    const db = await getDB();
    const tx = db.transaction('dailyActivity', 'readonly');
    const index = tx.store.index('by-synced');
    const all = await index.getAll(IDBKeyRange.only(false));
    return all as DailyActivity[];
}

export async function markSynced(dates: string[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('dailyActivity', 'readwrite');
    for (const date of dates) {
        const record = await tx.store.get(date) as DailyActivity | undefined;
        if (record) {
            await tx.store.put({ ...record, synced: true });
        }
    }
    await tx.done;
}

// ─── Achievements ──────────────────────────────────────────────────────────────

export async function saveAchievement(ach: AchievementRecord): Promise<void> {
    const db = await getDB();
    await db.put('achievements', ach);
}

export async function getAllAchievements(): Promise<AchievementRecord[]> {
    const db = await getDB();
    return db.getAll('achievements');
}

// ─── Meta helpers ──────────────────────────────────────────────────────────────

export async function getMeta<T>(key: string): Promise<T | undefined> {
    const db = await getDB();
    const rec = await db.get('meta', key) as { key: string; value: T } | undefined;
    return rec?.value;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
    const db = await getDB();
    await db.put('meta', { key, value });
}

// ─── Sync Payload ─────────────────────────────────────────────────────────────

export interface SyncPayload {
    entries: { date: string; score: number; timeTaken: number; difficulty: Difficulty }[];
}

export async function buildSyncPayload(): Promise<SyncPayload> {
    const unsynced = await getUnsyncedActivity();
    return {
        entries: unsynced.map(a => ({
            date: a.date,
            score: a.score,
            timeTaken: a.timeTaken,
            difficulty: a.difficulty,
        })),
    };
}

// ─── Streak Calculation (Pure Client-Side) ─────────────────────────────────────

export function calculateStreakFromActivity(
    activityMap: Map<string, DailyActivity>
): { current: number; longest: number } {
    let streak = 0;
    let tempStreak = 0;
    let longest = 0;

    // current streak: walk backwards from today
    let cursor = new Date();
    // Allow today to be unplayed without breaking a streak from yesterday
    if (!activityMap.get(formatDateLocal(cursor))?.solved) {
        cursor.setDate(cursor.getDate() - 1);
    }
    
    while (true) {
        const key = formatDateLocal(cursor);
        if (activityMap.get(key)?.solved) {
            streak++;
            cursor.setDate(cursor.getDate() - 1);
        } else {
            break;
        }
    }

    // longest streak
    const allDates = Array.from(activityMap.keys()).sort();
    let lastDate: Date | null = null;
    
    for (const d of allDates) {
        if (activityMap.get(d)?.solved) {
            const thisDate = new Date(d);
            if (lastDate) {
                // Determine days between lastDate and thisDate
                const diffTime = Math.abs(thisDate.getTime() - lastDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays === 1) {
                    tempStreak++;
                } else if (diffDays > 1) {
                    tempStreak = 1; // broken streak
                }
            } else {
                tempStreak = 1;
            }
            longest = Math.max(longest, tempStreak);
            lastDate = thisDate;
        } else {
            tempStreak = 0;
        }
    }

    return { current: streak, longest: Math.max(longest, streak) };
}

// ─── Intensity ────────────────────────────────────────────────────────────────

export type IntensityLevel = 0 | 1 | 2 | 3 | 4;

export const INTENSITY_LABELS_MAP: Record<IntensityLevel, string> = {
    0: 'Not played',
    1: 'Easy solved',
    2: 'Medium solved',
    3: 'Hard solved',
    4: 'Perfect score',
};

export function getIntensityLevel(activity?: DailyActivity): IntensityLevel {
    if (!activity || !activity.solved) return 0;
    if (activity.score >= 950 || activity.timeTaken < 90) return 4;
    if (activity.difficulty >= 2) return 3;
    if (activity.difficulty === 1) return 2;
    return 1;
}

// ─── Year Grid ────────────────────────────────────────────────────────────────

export interface HeatmapDay {
    date: string;
    dayOfWeek: number;
    weekIndex: number;
    monthLabel?: string;
    isToday: boolean;
    isFuture: boolean;
    activity?: DailyActivity;
    intensity: IntensityLevel;
    isStreakStart?: boolean;  // first day of a consecutive streak run
    isStreakEnd?: boolean;    // last day of a consecutive streak run
    isStreakMid?: boolean;    // middle of a streak run (for visual connection)
}

export function buildYearGrid(
    activityMap: Map<string, DailyActivity>,
    year?: number
): HeatmapDay[][] {
    const y = year ?? new Date().getFullYear();
    const start = new Date(y, 0, 1);
    const today = new Date();
    // Proper leap year: divisible by 4, except centuries unless also by 400
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const totalDays = isLeap ? 366 : 365;

    // Build flat list of days first
    const flatDays: HeatmapDay[] = [];
    for (let i = 0; i < totalDays; i++) {
        const d = new Date(y, 0, i + 1); // avoids DST issues vs setDate
        const dateStr = formatDateLocal(d);
        const activity = activityMap.get(dateStr);
        const isToday = isSameDay(d, today);
        const isFuture = d > today && !isToday;

        flatDays.push({
            date: dateStr,
            dayOfWeek: d.getDay(),
            weekIndex: 0, // filled below
            isToday,
            isFuture,
            activity,
            intensity: isFuture ? 0 : getIntensityLevel(activity),
            monthLabel: d.getDate() === 1
                ? d.toLocaleString('default', { month: 'short' })
                : undefined,
        });
    }

    // Tag streak runs for visual connection
    for (let i = 0; i < flatDays.length; i++) {
        const d = flatDays[i];
        if (!d.activity?.solved) continue;
        const prevSolved = i > 0 && flatDays[i - 1].activity?.solved;
        const nextSolved = i < flatDays.length - 1 && flatDays[i + 1].activity?.solved;
        d.isStreakStart = !prevSolved && nextSolved;
        d.isStreakEnd = prevSolved && !nextSolved;
        d.isStreakMid = !!prevSolved && !!nextSolved;
    }

    // Build week columns (GitHub style: columns = weeks, rows = days of week)
    const weeks: HeatmapDay[][] = [];
    let weekIndex = 0;
    // Pad first week with start.getDay() empty slots
    let currentWeek: (HeatmapDay | null)[] = new Array(start.getDay()).fill(null);

    for (const day of flatDays) {
        day.weekIndex = weekIndex;
        if (currentWeek.length === 7) {
            weeks.push(currentWeek as HeatmapDay[]);
            currentWeek = [];
            weekIndex++;
        }
        currentWeek.push(day);
    }
    // Pad last week
    while (currentWeek.length < 7) currentWeek.push(null);
    if (currentWeek.length) weeks.push(currentWeek as HeatmapDay[]);

    return weeks;
}

// ─── Month Summary ──────────────────────────────────────────────────────────

export interface MonthSummary {
    month: string;        // 'Jan', 'Feb', etc.
    monthNum: number;     // 1-12
    totalDays: number;
    solvedDays: number;
    avgScore: number;
    perfectDays: number;
    bestStreak: number;
}

export function buildMonthSummaries(
    activityMap: Map<string, DailyActivity>,
    year?: number
): MonthSummary[] {
    const y = year ?? new Date().getFullYear();
    const summaries: MonthSummary[] = [];

    for (let m = 0; m < 12; m++) {
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        let solvedDays = 0;
        let totalScore = 0;
        let perfectDays = 0;
        let bestStreak = 0;
        let curStreak = 0;

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(y, m, d);
            // Don't count future days
            if (date > new Date()) break;
            const dateStr = formatDateLocal(date);
            const a = activityMap.get(dateStr);
            if (a?.solved) {
                solvedDays++;
                totalScore += a.score;
                if (getIntensityLevel(a) === 4) perfectDays++;
                curStreak++;
                bestStreak = Math.max(bestStreak, curStreak);
            } else {
                curStreak = 0;
            }
        }

        summaries.push({
            month: new Date(y, m, 1).toLocaleString('default', { month: 'short' }),
            monthNum: m + 1,
            totalDays: daysInMonth,
            solvedDays,
            avgScore: solvedDays > 0 ? Math.round(totalScore / solvedDays) : 0,
            perfectDays,
            bestStreak,
        });
    }
    return summaries;
}

// ─── Deterministic Puzzle Seed (SHA-256 of date + secret key) ────────────────

// Sync fallback using FNV-1a (used before SHA-256 resolves)
export function getPuzzleSeedForDate(date: string): number {
    const SECRET = 'LL-v1-daily-puzzle-2024';
    const input = date + ':' + SECRET;
    let hash = 2166136261; // FNV offset basis
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = (hash * 16777619) >>> 0; // FNV prime, unsigned 32-bit
    }
    return hash;
}

/**
 * Async SHA-256 seed — same puzzle for all users on same date.
 * Falls back to synchronous FNV-1a if crypto unavailable.
 */
export async function getPuzzleSeedForDateAsync(date: string): Promise<number> {
    try {
        const SECRET = 'LL-v1-daily-puzzle-2024';
        const input = date + ':' + SECRET;
        const encoded = new TextEncoder().encode(input);
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
        const view = new DataView(hashBuffer);
        // Use first 4 bytes as uint32
        return view.getUint32(0, false);
    } catch {
        return getPuzzleSeedForDate(date);
    }
}

// ─── Puzzle Progress (in-progress save/restore) ───────────────────────────────

export interface PuzzleProgressRecord {
    date: string;       // YYYY-MM-DD — primary key
    answer: unknown;    // userAnswer state (serializable)
    hintsUsed: number;
    timeTaken: number;
    savedAt: string;
}

export async function savePuzzleProgress(record: PuzzleProgressRecord): Promise<void> {
    const db = await getDB();
    await db.put('puzzleProgress', record);
}

export async function getPuzzleProgress(date: string): Promise<PuzzleProgressRecord | undefined> {
    const db = await getDB();
    return db.get('puzzleProgress', date) as Promise<PuzzleProgressRecord | undefined>;
}

export async function clearPuzzleProgress(date: string): Promise<void> {
    const db = await getDB();
    await db.delete('puzzleProgress', date);
}

// ─── Utils ────────────────────────────────────────────────────────────────────

export function formatDateLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}
