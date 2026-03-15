/**
 * Logic Looper — Express API Server + Socket.io
 * Designed for Vercel Serverless Functions (single-entry handler)
 * Also runnable standalone: npm run server
 */

import 'dotenv/config';
import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import scoresRouter from './routes/scores';
import leaderboardRouter from './routes/leaderboard';
import { attachChallengeSocket } from './routes/challenge';

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
        ? [/\.vercel\.app$/, /localhost/]
        : '*',
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger (dev only)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, _res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
    });
}

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        app: 'Logic Looper API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV,
    });
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/auth', authRouter);
app.use('/api/sync', scoresRouter);
app.use('/api/leaderboard', leaderboardRouter);

// ─── 404 + Error handlers ─────────────────────────────────────────────────────

app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Server Error]', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ─── HTTP Server + Socket.io ──────────────────────────────────────────────────

const httpServer = createServer(app);

const io = new SocketServer(httpServer, {
    cors: {
        ...corsOptions,
        origin: process.env.NODE_ENV === 'production'
            ? ['https://*.vercel.app', 'http://localhost:5173']
            : '*',
    },
    transports: ['websocket', 'polling'],
});

attachChallengeSocket(io);

// ─── Start (standalone mode) ──────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ESM-compatible check: compare the resolved file path with process.argv[1]
const __filename = fileURLToPath(import.meta.url);
const isMain = resolve(process.argv[1]) === resolve(__filename);

if (process.env.NODE_ENV !== 'production' || isMain) {
    httpServer.listen(PORT, () => {
        console.log(`\n🎮 Logic Looper API running on http://localhost:${PORT}`);
        console.log(`   Health:    http://localhost:${PORT}/api/health`);
        console.log(`   Socket.io: ws://localhost:${PORT}/challenge\n`);
    });
}

export default app;
