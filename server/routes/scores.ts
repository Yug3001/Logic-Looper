/**
 * Score Sync Routes
 * POST /api/sync/daily-scores  — Batch upsert daily scores (offline→online sync)
 * GET  /api/sync/status        — Check how many pending scores are on server
 */

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authMiddleware } from '../lib/auth';
import { validateScoreEntry } from '../lib/scoreValidator';

const router = Router();

// ─── Batch Sync ───────────────────────────────────────────────────────────────

/**
 * POST /api/sync/daily-scores
 * Body: { entries: [{ date, score, timeTaken, difficulty, puzzleType }] }
 * Validates each entry, upserts to DB, updates user totals.
 */
router.post('/daily-scores', authMiddleware, async (req: Request, res: Response) => {
    const { userId } = (req as any).user;

    // Guests don't sync
    if (userId.startsWith('guest_')) {
        res.json({ synced: 0, skipped: 0, message: 'Guests do not sync' });
        return;
    }

    const { entries } = req.body as {
        entries: {
            date: string;
            score: number;
            timeTaken: number;
            difficulty: number;
            puzzleType?: string;
        }[];
    };

    if (!Array.isArray(entries) || entries.length === 0) {
        res.status(400).json({ error: 'entries[] array required' });
        return;
    }

    if (entries.length > 370) {
        res.status(400).json({ error: 'Too many entries (max 370)' });
        return;
    }

    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const entry of entries) {
        const validation = validateScoreEntry(entry);
        if (!validation.valid) {
            skipped++;
            errors.push(`${entry.date}: ${validation.reason}`);
            continue;
        }

        try {
            await prisma.dailyScore.upsert({
                where: {
                    userId_date: {
                        userId,
                        date: new Date(entry.date),
                    },
                },
                update: {
                    score: entry.score,
                    timeTaken: entry.timeTaken,
                    difficulty: entry.difficulty,
                    puzzleType: entry.puzzleType ?? 'matrix',
                },
                create: {
                    userId,
                    date: new Date(entry.date),
                    score: entry.score,
                    timeTaken: entry.timeTaken,
                    difficulty: entry.difficulty,
                    puzzleType: entry.puzzleType ?? 'matrix',
                },
            });
            synced++;
        } catch (err: any) {
            skipped++;
            errors.push(`${entry.date}: DB error`);
        }
    }

    // Update user totals and streak
    try {
        const allScores = await prisma.dailyScore.findMany({
            where: { userId },
            orderBy: { date: 'desc' },
        });

        const totalPoints = allScores.reduce((sum, s) => sum + s.score, 0);
        const { current: streakCount } = calcStreak(allScores.map(s => s.date.toISOString().split('T')[0]));

        await prisma.user.update({
            where: { id: userId },
            data: {
                totalPoints,
                streakCount,
                lastPlayed: new Date(),
            },
        });

        await prisma.userStats.upsert({
            where: { userId },
            update: {
                puzzlesSolved: allScores.length,
                avgSolveTime: Math.round(allScores.reduce((s, x) => s + x.timeTaken, 0) / (allScores.length || 1)),
                bestStreak: streakCount,
            },
            create: {
                userId,
                puzzlesSolved: allScores.length,
                avgSolveTime: 0,
                bestStreak: streakCount,
            },
        });
    } catch (err) {
        console.error('[Sync] Failed to update user totals:', err);
    }

    res.json({ synced, skipped, errors: errors.slice(0, 10) });
});

// ─── Streak Calculator ────────────────────────────────────────────────────────

function calcStreak(sortedDatesDesc: string[]): { current: number } {
    const sorted = [...new Set(sortedDatesDesc)].sort().reverse();
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    let cursor = today;

    for (const d of sorted) {
        if (d === cursor) {
            streak++;
            const prev = new Date(cursor);
            prev.setDate(prev.getDate() - 1);
            cursor = prev.toISOString().split('T')[0];
        } else if (d < cursor) {
            break;
        }
    }
    return { current: streak };
}

export default router;
