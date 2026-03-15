import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import dayjs from 'dayjs';

export interface DailyScore {
    date: string; // YYYY-MM-DD
    puzzleId: number;
    score: number;
    timeTaken: number; // seconds
    puzzleType: 'matrix' | 'pattern' | 'sequence' | 'deduction' | 'binary';
    hintsUsed: number;
    completed: boolean;
}

export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    unlockedAt: string | null;
    category: 'streak' | 'speed' | 'accuracy' | 'milestone';
}

export interface AnalyticsState {
    dailyScores: DailyScore[];
    currentStreak: number;
    longestStreak: number;
    totalPuzzlesSolved: number;
    totalPoints: number;
    avgSolveTime: number;
    achievements: Achievement[];
    leaderboard: LeaderboardEntry[];
    weeklyProgress: WeeklyEntry[];
    puzzleTypeStats: PuzzleTypeStat[];
    lastSyncedAt: string | null;
    hintUsageByDay: { date: string; count: number }[];
}

export interface LeaderboardEntry {
    rank: number;
    username: string;
    score: number;
    streak: number;
    country: string;
    avatar: string;
    isCurrentUser?: boolean;
}

export interface WeeklyEntry {
    day: string;
    score: number;
    time: number;
    completed: boolean;
}

export interface PuzzleTypeStat {
    type: string;
    solved: number;
    avgTime: number;
    bestTime: number;
    accuracy: number;
    color: string;
}

const allAchievements: Achievement[] = [
    { id: 'first_solve', title: 'First Steps', description: 'Solved your first puzzle', icon: '🎯', unlockedAt: null, category: 'milestone' },
    { id: 'streak_7', title: 'Week Warrior', description: '7-day solving streak', icon: '🔥', unlockedAt: null, category: 'streak' },
    { id: 'streak_30', title: 'Monthly Master', description: '30-day solving streak', icon: '⚡', unlockedAt: null, category: 'streak' },
    { id: 'streak_100', title: 'Century Club', description: '100-day solving streak', icon: '💫', unlockedAt: null, category: 'streak' },
    { id: 'speed_demon', title: 'Speed Demon', description: 'Solved a puzzle under 60s', icon: '⚡', unlockedAt: null, category: 'speed' },
    { id: 'perfect_week', title: 'Perfect Week', description: '7 days with max score', icon: '🌟', unlockedAt: null, category: 'accuracy' },
    { id: 'no_hints', title: 'Pure Genius', description: 'Solved 10 puzzles without hints', icon: '🧠', unlockedAt: null, category: 'accuracy' },
    { id: 'all_types', title: 'Versatile', description: 'Solved all 5 puzzle types', icon: '🎮', unlockedAt: null, category: 'milestone' },
    { id: 'streak_200', title: 'Bicentennial', description: '200-day solving streak', icon: '👑', unlockedAt: null, category: 'streak' },
    { id: 'top_10', title: 'Elite Solver', description: 'Reached top 10 globally', icon: '🏆', unlockedAt: null, category: 'milestone' },
    { id: 'lightning', title: 'Lightning Round', description: 'Solved puzzle under 30s', icon: '🌩️', unlockedAt: null, category: 'speed' },
    { id: 'hundred_puzzles', title: 'Centurion', description: 'Solved 100 puzzles total', icon: '💯', unlockedAt: null, category: 'milestone' },
];

const initialState: AnalyticsState = {
    dailyScores: [],
    currentStreak: 0,
    longestStreak: 0,
    totalPuzzlesSolved: 0,
    totalPoints: 0,
    avgSolveTime: 0,
    achievements: allAchievements,
    leaderboard: [],
    weeklyProgress: [],
    puzzleTypeStats: [],
    lastSyncedAt: null,
    hintUsageByDay: [],
};

const analyticsSlice = createSlice({
    name: 'analytics',
    initialState,
    reducers: {
        recordDailyScore(state, action: PayloadAction<DailyScore>) {
            const existing = state.dailyScores.findIndex(s => s.date === action.payload.date);
            if (existing >= 0) {
                state.dailyScores[existing] = action.payload;
            } else {
                state.dailyScores.push(action.payload);
            }
            state.totalPuzzlesSolved = state.dailyScores.filter(s => s.completed).length;
            state.totalPoints = state.dailyScores.reduce((sum, s) => sum + s.score, 0);
        },
        updateStreak(state, action: PayloadAction<{ current: number; longest: number }>) {
            state.currentStreak = action.payload.current;
            state.longestStreak = action.payload.longest;
        },
        unlockAchievement(state, action: PayloadAction<string>) {
            const ach = state.achievements.find(a => a.id === action.payload);
            if (ach && !ach.unlockedAt) {
                ach.unlockedAt = new Date().toISOString();
            }
        },
        setAchievements(state, action: PayloadAction<{ id: string; unlockedAt: string }[]>) {
            action.payload.forEach(payloadAch => {
                const ach = state.achievements.find(a => a.id === payloadAch.id);
                if (ach) {
                    ach.unlockedAt = payloadAch.unlockedAt;
                }
            });
        },
        syncFromActivity(state, action: PayloadAction<{ activities: any[], currentStreak: number, longestStreak: number }>) {
            const activities = action.payload.activities;
            const solved = activities.filter(a => a.solved);
            state.dailyScores = activities.map(a => ({
                date: a.date,
                puzzleId: 0,
                score: a.score,
                timeTaken: a.timeTaken,
                puzzleType: a.puzzleType,
                hintsUsed: a.hintsUsed,
                completed: a.solved,
            }));
            state.totalPuzzlesSolved = solved.length;
            state.totalPoints = solved.reduce((sum, a) => sum + a.score, 0);
            state.avgSolveTime = solved.length > 0 ? solved.reduce((sum, a) => sum + a.timeTaken, 0) / solved.length : 0;
            state.currentStreak = action.payload.currentStreak;
            state.longestStreak = action.payload.longestStreak;
            
            const typeMap: Record<string, { solved: number, time: number, best: number }> = {};
            solved.forEach(a => {
                if (!typeMap[a.puzzleType]) typeMap[a.puzzleType] = { solved: 0, time: 0, best: 999999 };
                typeMap[a.puzzleType].solved++;
                typeMap[a.puzzleType].time += a.timeTaken;
                if (a.timeTaken < typeMap[a.puzzleType].best) {
                    typeMap[a.puzzleType].best = a.timeTaken;
                }
            });
            const colors: Record<string, string> = { matrix: '#6366f1', pattern: '#ec4899', sequence: '#f59e0b', deduction: '#10b981', binary: '#0ea5e9' };
            state.puzzleTypeStats = Object.keys(typeMap).map(type => ({
                type,
                solved: typeMap[type].solved,
                avgTime: typeMap[type].time / typeMap[type].solved,
                bestTime: typeMap[type].best,
                accuracy: 100,
                color: colors[type] || '#6366f1'
            }));
            
            // Compute weekly progress
            const weekly: Record<string, WeeklyEntry> = {};
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
                const dayLabel = dayNames[d.getDay()];
                const found = activities.find(a => a.date === dateStr);
                weekly[dayLabel] = {
                    day: dayLabel,
                    score: found?.score || 0,
                    time: found?.timeTaken || 0,
                    completed: found?.solved || false,
                };
            }
            state.weeklyProgress = Object.values(weekly);
        },
    },
});

export const { recordDailyScore, updateStreak, unlockAchievement, setAchievements, syncFromActivity } = analyticsSlice.actions;
export default analyticsSlice.reducer;
