/**
 * useHeatmap — Primary hook for the heatmap feature.
 *
 * Responsibilities:
 *  - Loads all activity from IndexedDB on mount
 *  - Builds the year grid (deterministic)
 *  - Provides streak, pending sync count, and methods to record a solve
 *  - Triggers achievement evaluation after each solve
 *  - Registers online/offline sync listeners
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { unlockAchievement, setAchievements, syncFromActivity } from '../store/analyticsSlice';
import {
    getAllActivity,
    saveActivity,
    buildYearGrid,
    calculateStreakFromActivity,
    formatDateLocal,
    getIntensityLevel,
    HeatmapDay,
    DailyActivity,
    Difficulty,
    getAllAchievements,
} from '../lib/db';
import { attemptSync, registerSyncListeners, validateScore, validateLocalDate } from '../lib/syncService';
import { evaluateAchievements } from '../lib/achievementEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseHeatmapReturn {
    weeks: HeatmapDay[][];
    activityMap: Map<string, DailyActivity>;
    currentStreak: number;
    longestStreak: number;
    totalSolved: number;
    unsyncedCount: number;
    newlyUnlocked: string[];
    isSyncing: boolean;
    isLoaded: boolean;
    selectedYear: number;
    setSelectedYear: (y: number) => void;
    recordSolve: (params: RecordSolveParams) => Promise<RecordSolveResult>;
    manualSync: () => Promise<void>;
    dismissNewAchievements: () => void;
    getMilestoneForStreak: (streak: number) => MilestoneBadge | null;
}

export interface RecordSolveParams {
    score: number;
    timeTaken: number;
    difficulty: Difficulty;
    puzzleType: string;
    hintsUsed?: number;
    date?: string; // defaults to today
    solved?: boolean; // defaults to true
}

export interface RecordSolveResult {
    success: boolean;
    error?: string;
    newAchievements?: string[];
}

export interface MilestoneBadge {
    label: string;
    emoji: string;
    color: string;
}

const MILESTONES: { threshold: number; badge: MilestoneBadge }[] = [
    { threshold: 7, badge: { label: '1 Week!', emoji: '🔥', color: '#F59E0B' } },
    { threshold: 14, badge: { label: '2 Weeks!', emoji: '🔥', color: '#F97316' } },
    { threshold: 30, badge: { label: '1 Month!', emoji: '⚡', color: '#10B981' } },
    { threshold: 50, badge: { label: '50 Days!', emoji: '💫', color: '#7C3AED' } },
    { threshold: 100, badge: { label: '100 Days!', emoji: '👑', color: '#EC4899' } },
    { threshold: 200, badge: { label: '200 Days!', emoji: '💎', color: '#06B6D4' } },
    { threshold: 365, badge: { label: 'Full Year!', emoji: '🏆', color: '#F9CA24' } },
];

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useHeatmap(year?: number): UseHeatmapReturn {
    const dispatch = useDispatch();
    const [selectedYear, setSelectedYear] = useState(year ?? new Date().getFullYear());
    const [activityMap, setActivityMap] = useState<Map<string, DailyActivity>>(new Map());
    const [isLoaded, setIsLoaded] = useState(false);
    const [unsyncedCount, setUnsyncedCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [newlyUnlocked, setNewlyUnlocked] = useState<string[]>([]);

    // Seed mock data on first load (dev only — in prod, real IDB data is used)
    const seededRef = useRef(false);

    // Load from IndexedDB
    const loadActivity = useCallback(async () => {
        try {
            const [allActivity, dbAchievements] = await Promise.all([
                getAllActivity(),
                getAllAchievements(),
            ]);

            const map = new Map<string, DailyActivity>();
            let unsynced = 0;
            for (const a of allActivity) {
                map.set(a.date, a);
                if (!a.synced) unsynced++;
            }
            setActivityMap(map);
            setUnsyncedCount(unsynced);
            setIsLoaded(true);

            // Sync locked/unlocked state to Redux for global UI
            dispatch(setAchievements(dbAchievements));
            
            // Sync all activity to Redux for analytics dashboard
            const { current: currentStreak, longest: longestStreak } = calculateStreakFromActivity(map);
            dispatch(syncFromActivity({ activities: allActivity, currentStreak, longestStreak }));
        } catch (err) {
            console.error('[useHeatmap] Failed to load activity:', err);
            setIsLoaded(true);
        }
    }, [dispatch]);

    useEffect(() => {
        loadActivity();
        // Register online→sync listener
        const cleanup = registerSyncListeners(loadActivity);
        return cleanup;
    }, [loadActivity]);

    // Computed values
    const { current: currentStreak, longest: longestStreak } = useMemo(
        () => calculateStreakFromActivity(activityMap),
        [activityMap],
    );

    const totalSolved = useMemo(
        () => Array.from(activityMap.values()).filter(a => a.solved).length,
        [activityMap],
    );

    const weeks = useMemo(
        () => buildYearGrid(activityMap, selectedYear),
        [activityMap, selectedYear],
    );

    // Record a solve
    const recordSolve = useCallback(async (params: RecordSolveParams): Promise<RecordSolveResult> => {
        const date = params.date ?? formatDateLocal(new Date());

        // Anti-cheat: validate device clock hasn't been rolled back
        const dateCheck = await validateLocalDate();
        if (!dateCheck.valid) {
            return { success: false, error: dateCheck.reason ?? 'Invalid device time' };
        }

        const validation = validateScore({
            score: params.score,
            timeTaken: params.timeTaken,
            difficulty: params.difficulty,
        });
        if (!validation.valid) {
            return { success: false, error: validation.reason };
        }

        const activity: DailyActivity = {
            date,
            solved: params.solved ?? true,
            score: params.score,
            timeTaken: params.timeTaken,
            difficulty: params.difficulty,
            puzzleType: params.puzzleType,
            hintsUsed: params.hintsUsed ?? 0,
            synced: false,
            completedAt: new Date().toISOString(),
        };

        await saveActivity(activity);
        await loadActivity();

        // Evaluate achievements
        const newMap = new Map(activityMap);
        newMap.set(date, activity);
        const { current: newStreak } = calculateStreakFromActivity(newMap);
        const achievements = await evaluateAchievements(newStreak);
        if (achievements.length > 0) {
            setNewlyUnlocked(prev => [...prev, ...achievements]);
            achievements.forEach(id => dispatch(unlockAchievement(id)));
        }

        // Attempt background sync (non-blocking)
        if (navigator.onLine) {
            attemptSync().catch(console.warn);
        }

        return { success: true, newAchievements: achievements };
    }, [activityMap, loadActivity]);

    // Manual sync trigger
    const manualSync = useCallback(async () => {
        setIsSyncing(true);
        await attemptSync(true);
        await loadActivity();
        setIsSyncing(false);
    }, [loadActivity]);

    const dismissNewAchievements = useCallback(() => {
        setNewlyUnlocked([]);
    }, []);

    const getMilestoneForStreak = useCallback((streak: number): MilestoneBadge | null => {
        const match = MILESTONES.find(m => m.threshold === streak);
        return match?.badge ?? null;
    }, []);

    return {
        weeks,
        activityMap,
        currentStreak,
        longestStreak,
        totalSolved,
        unsyncedCount,
        newlyUnlocked,
        isSyncing,
        isLoaded,
        selectedYear,
        setSelectedYear,
        recordSolve,
        manualSync,
        dismissNewAchievements,
        getMilestoneForStreak,
    };
}

// ─── Dev Seed ─────────────────────────────────────────────────────────────────

async function seedMockData(): Promise<void> {
    const puzzleTypes = ['matrix', 'pattern', 'sequence', 'deduction', 'binary'];
    const difficulties: Difficulty[] = [0, 1, 2, 3];
    const today = new Date();

    for (let i = 364; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = formatDateLocal(d);

        const completionChance = i < 30 ? 0.93 : 0.72;
        if (Math.random() > completionChance) continue;

        const difficulty = difficulties[Math.floor(Math.random() * 4)];
        const baseTime = 90 + Math.floor(Math.random() * 350);
        const baseScore = 600 + Math.floor(Math.random() * 400);
        const isPerfect = Math.random() > 0.85;

        await saveActivity({
            date: dateStr,
            solved: true,
            score: isPerfect ? 950 + Math.floor(Math.random() * 50) : baseScore,
            timeTaken: isPerfect ? 60 + Math.floor(Math.random() * 60) : baseTime,
            difficulty,
            puzzleType: puzzleTypes[Math.floor(Math.random() * 5)],
            hintsUsed: Math.floor(Math.random() * 3),
            synced: i > 2,
            completedAt: d.toISOString(),
        });
    }
}
