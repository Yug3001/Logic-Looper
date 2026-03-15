/**
 * Logic Looper — Achievement Engine (100% Client-Side)
 * Checks conditions against local IndexedDB data and triggers badge unlocks.
 * Persists to IndexedDB `achievements` store.
 */

import { DailyActivity, getAllActivity, getAllAchievements, saveAchievement, AchievementRecord } from './db';

// ─── Definitions ──────────────────────────────────────────────────────────────

export interface AchievementDef {
    id: string;
    title: string;
    description: string;
    icon: string;
    category: 'streak' | 'speed' | 'accuracy' | 'milestone';
    check: (activity: DailyActivity[], streak: number) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
    {
        id: 'first_solve',
        title: 'First Steps',
        description: 'Solve your very first puzzle',
        icon: '🎯',
        category: 'milestone',
        check: (a) => a.some(d => d.solved),
    },
    {
        id: 'streak_7',
        title: 'Week Warrior',
        description: '7-day solving streak',
        icon: '🔥',
        category: 'streak',
        check: (_, s) => s >= 7,
    },
    {
        id: 'streak_30',
        title: 'Monthly Master',
        description: '30-day solving streak',
        icon: '⚡',
        category: 'streak',
        check: (_, s) => s >= 30,
    },
    {
        id: 'streak_100',
        title: 'Century Club',
        description: '100-day solving streak',
        icon: '💫',
        category: 'streak',
        check: (_, s) => s >= 100,
    },
    {
        id: 'streak_200',
        title: 'Bicentennial',
        description: '200-day solving streak',
        icon: '👑',
        category: 'streak',
        check: (_, s) => s >= 200,
    },
    {
        id: 'speed_demon',
        title: 'Speed Demon',
        description: 'Solve a puzzle in under 60 seconds',
        icon: '⚡',
        category: 'speed',
        check: (a) => a.some(d => d.solved && d.timeTaken < 60),
    },
    {
        id: 'lightning',
        title: 'Lightning Round',
        description: 'Solve a puzzle in under 30 seconds',
        icon: '🌩️',
        category: 'speed',
        check: (a) => a.some(d => d.solved && d.timeTaken < 30),
    },
    {
        id: 'no_hints_10',
        title: 'Pure Genius',
        description: 'Solve 10 puzzles without hints',
        icon: '🧠',
        category: 'accuracy',
        check: (a) => a.filter(d => d.solved && d.hintsUsed === 0).length >= 10,
    },
    {
        id: 'perfect_score',
        title: 'Perfect Score',
        description: 'Score 1000 points on a puzzle',
        icon: '💯',
        category: 'accuracy',
        check: (a) => a.some(d => d.score >= 1000),
    },
    {
        id: 'perfect_week',
        title: 'Perfect Week',
        description: 'Solve 7 consecutive days',
        icon: '🌟',
        category: 'accuracy',
        check: (_, s) => s >= 7,
    },
    {
        id: 'hundred_puzzles',
        title: 'Centurion',
        description: 'Solve 100 total puzzles',
        icon: '🏅',
        category: 'milestone',
        check: (a) => a.filter(d => d.solved).length >= 100,
    },
    {
        id: 'perfect_month',
        title: 'Perfect Month',
        description: 'Solve every puzzle in a calendar month',
        icon: '📅',
        category: 'milestone',
        check: (a) => checkPerfectMonth(a),
    },
];

function checkPerfectMonth(activity: DailyActivity[]): boolean {
    const byMonth: Record<string, { solved: number; total: number }> = {};
    activity.forEach(d => {
        const [y, m] = d.date.split('-');
        const key = `${y}-${m}`;
        if (!byMonth[key]) byMonth[key] = { solved: 0, total: 0 };
        byMonth[key].total++;
        if (d.solved) byMonth[key].solved++;
    });
    return Object.values(byMonth).some(
        ({ solved, total }) => total >= 28 && solved === total,
    );
}

// ─── Evaluator ────────────────────────────────────────────────────────────────

/**
 * Runs all achievement checks against current IndexedDB data.
 * Returns newly unlocked achievement IDs (for notification/animation).
 */
export async function evaluateAchievements(
    currentStreak: number
): Promise<string[]> {
    const [allActivity, existingDB] = await Promise.all([
        getAllActivity(),
        getAllAchievements(),
    ]);

    const existingIds = new Set(existingDB.map(a => a.id));
    const newlyUnlocked: string[] = [];

    for (const def of ACHIEVEMENTS) {
        if (existingIds.has(def.id)) continue; // already unlocked
        if (def.check(allActivity, currentStreak)) {
            const record: AchievementRecord = {
                id: def.id,
                unlockedAt: new Date().toISOString(),
                notified: false,
            };
            await saveAchievement(record);
            newlyUnlocked.push(def.id);
            console.log(`[Achievement] Unlocked: ${def.title}`);
        }
    }

    return newlyUnlocked;
}
