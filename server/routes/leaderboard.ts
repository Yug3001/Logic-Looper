/**
 * Leaderboard Routes
 * GET /api/leaderboard/global   — Top 100 all-time
 * GET /api/leaderboard/daily    — Top 100 for today
 * GET /api/leaderboard/rank/:userId — User's current rank
 */

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { optionalAuth } from '../lib/auth';
import { getRoomsSnapshot } from './challenge';

const router = Router();

// ─── Live Active Sessions ──────────────────────────────────────────────────────

router.get('/live', (_req: Request, res: Response) => {
    try {
        res.json({ rooms: getRoomsSnapshot(), ts: Date.now() });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch live data' });
    }
});

// ─── Global Leaderboard (Top 100) ─────────────────────────────────────────────

router.get('/global', optionalAuth, async (_req: Request, res: Response) => {
    try {
        const top100 = await prisma.user.findMany({
            where: { totalPoints: { gt: 0 } },
            orderBy: { totalPoints: 'desc' },
            take: 100,
            select: {
                id: true,
                name: true,
                avatar: true,
                totalPoints: true,
                streakCount: true,
                stats: { select: { puzzlesSolved: true, avgSolveTime: true } },
            },
        });

        const ranked = top100.map((u, i) => ({
            rank: i + 1,
            userId: u.id,
            name: u.name ?? 'Anonymous',
            avatar: u.avatar,
            totalPoints: u.totalPoints,
            streakCount: u.streakCount,
            puzzlesSolved: u.stats?.puzzlesSolved ?? 0,
            avgSolveTime: u.stats?.avgSolveTime ?? 0,
        }));

        res.json({ leaderboard: ranked, updatedAt: new Date().toISOString() });
    } catch (err) {
        console.error('[Leaderboard/Global]', err);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// ─── Daily Leaderboard ────────────────────────────────────────────────────────

router.get('/daily', optionalAuth, async (_req: Request, res: Response) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const topToday = await prisma.dailyScore.findMany({
            where: { date: { gte: today } },
            orderBy: { score: 'desc' },
            take: 100,
            include: {
                user: { select: { name: true, avatar: true } },
            },
        });

        const ranked = topToday.map((s, i) => ({
            rank: i + 1,
            userId: s.userId,
            name: s.user.name ?? 'Anonymous',
            avatar: s.user.avatar,
            score: s.score,
            timeTaken: s.timeTaken,
            difficulty: s.difficulty,
        }));

        res.json({ leaderboard: ranked, date: today.toISOString().split('T')[0] });
    } catch (err) {
        console.error('[Leaderboard/Daily]', err);
        res.status(500).json({ error: 'Failed to fetch daily leaderboard' });
    }
});

// ─── User Rank ────────────────────────────────────────────────────────────────

router.get('/rank/:userId', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { totalPoints: true },
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const rank = await prisma.user.count({
            where: { totalPoints: { gt: user.totalPoints } },
        });

        res.json({ rank: rank + 1, totalPoints: user.totalPoints });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch rank' });
    }
});

export default router;
