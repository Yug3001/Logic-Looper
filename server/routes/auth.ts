/**
 * Auth Routes
 * POST /api/auth/google   — Exchange Google OAuth token for JWT
 * POST /api/auth/guest    — Create/get guest session (localStorage only)
 * GET  /api/auth/me       — Get current user profile
 * POST /api/auth/refresh  — Refresh JWT
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { signToken, authMiddleware } from '../lib/auth';

const router = Router();

// ─── Local Email/Password ─────────────────────────────────────────────────────

router.post('/register', async (req: Request, res: Response) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            res.status(400).json({ error: 'Email, password, and name required.' });
            return;
        }

        if (password.length < 8) {
            res.status(400).json({ error: 'Password must be at least 8 characters long.' });
            return;
        }

        // Must contain both letters and numbers
        const hasLetters = /[a-zA-Z]/.test(password);
        const hasNumbers = /[0-9]/.test(password);
        if (!hasLetters || !hasNumbers) {
            res.status(400).json({ error: 'Password must contain a mixture of letters and numbers.' });
            return;
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            res.status(400).json({ error: 'Email is already in use.' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
                provider: 'local',
                stats: { create: {} },
            },
            include: { stats: true },
        });

        const token = signToken({ userId: user.id, email: user.email });

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
                streakCount: user.streakCount,
                totalPoints: user.totalPoints,
                stats: user.stats,
            },
        });
    } catch (err: any) {
        console.error('[Auth/Register]', err);
        res.status(500).json({ error: 'Registration failed.' });
    }
});

router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: 'Email and password required.' });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { email },
            include: { stats: true },
        });

        if (!user || !user.password) {
            res.status(401).json({ error: 'Invalid email or password.' });
            return;
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            res.status(401).json({ error: 'Invalid email or password.' });
            return;
        }

        const token = signToken({ userId: user.id, email: user.email });

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
                streakCount: user.streakCount,
                totalPoints: user.totalPoints,
                stats: user.stats,
            },
        });
    } catch (err: any) {
        console.error('[Auth/Login]', err);
        res.status(500).json({ error: 'Login failed.' });
    }
});

// ─── Google OAuth ─────────────────────────────────────────────────────────────

/**
 * POST /api/auth/google
 * Body: { idToken: string } — Google ID token from frontend
 * Verifies token with Google, upserts user, returns JWT
 */
router.post('/google', async (req: Request, res: Response) => {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            res.status(400).json({ error: 'idToken required' });
            return;
        }

        // Verify Google ID token
        const googleRes = await fetch(
            `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
        );

        if (!googleRes.ok) {
            res.status(401).json({ error: 'Invalid Google token' });
            return;
        }

        const googleUser = await googleRes.json() as {
            sub: string;
            email: string;
            name: string;
            picture: string;
            aud: string;
        };

        // Verify audience matches our client ID
        if (googleUser.aud !== process.env.GOOGLE_CLIENT_ID) {
            res.status(401).json({ error: 'Token audience mismatch' });
            return;
        }

        // Upsert user
        const user = await prisma.user.upsert({
            where: { email: googleUser.email },
            update: {
                name: googleUser.name,
                avatar: googleUser.picture,
                providerId: googleUser.sub,
            },
            create: {
                email: googleUser.email,
                name: googleUser.name,
                avatar: googleUser.picture,
                provider: 'google',
                providerId: googleUser.sub,
                stats: { create: {} },
            },
            include: { stats: true },
        });

        const token = signToken({ userId: user.id, email: user.email });

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
                streakCount: user.streakCount,
                totalPoints: user.totalPoints,
                stats: user.stats,
            },
        });
    } catch (err: any) {
        console.error('[Auth/Google]', err);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// ─── Guest Mode ───────────────────────────────────────────────────────────────

/**
 * POST /api/auth/guest
 * Issues a guest JWT (no DB record) — local data only.
 */
router.post('/guest', (_req: Request, res: Response) => {
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const token = signToken({ userId: guestId, email: `${guestId}@guest.local` });

    res.json({
        token,
        user: {
            id: guestId,
            email: null,
            name: 'Guest Player',
            avatar: null,
            isGuest: true,
            streakCount: 0,
            totalPoints: 0,
        },
    });
});

// ─── Me ───────────────────────────────────────────────────────────────────────

/**
 * GET /api/auth/me
 * Returns current user from JWT
 */
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
    const { userId } = (req as any).user;

    // Guest users have no DB record
    if (userId.startsWith('guest_')) {
        res.json({ isGuest: true, userId });
        return;
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { stats: true },
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            streakCount: user.streakCount,
            totalPoints: user.totalPoints,
            lastPlayed: user.lastPlayed,
            stats: user.stats,
        });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// ─── Logout ───────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/logout
 * Optional: server-side logout (e.g. for cookie clearing or token blacklisting)
 */
router.post('/logout', (_req: Request, res: Response) => {
    res.json({ message: 'Logged out successfully' });
});

export default router;

