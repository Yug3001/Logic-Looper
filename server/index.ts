/**
 * Logic Looper — Express API Server + Socket.io
 */

import 'dotenv/config';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRouter from './routes/auth';
import scoresRouter from './routes/scores';
import leaderboardRouter from './routes/leaderboard';
import { attachChallengeSocket } from './routes/challenge';

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(helmet({ crossOriginResourcePolicy: false }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

app.use(limiter);

const corsOptions = {
  origin:
    process.env.NODE_ENV === 'production'
      ? [/\.vercel\.app$/, /localhost/]
      : '*',
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Dev request logger
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

// ─── 404 handler ──────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── HTTP Server + Socket.io ──────────────────────────────────────────────────

const httpServer = createServer(app);

const io = new SocketServer(httpServer, {
  cors: {
    origin:
      process.env.NODE_ENV === 'production'
        ? ['https://*.vercel.app', 'http://localhost:5173']
        : '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

attachChallengeSocket(io);

// ─── Start Server ─────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3001', 10);

httpServer.listen(PORT, () => {
  console.log(`🎮 Logic Looper API running on port ${PORT}`);
  console.log(`Health endpoint: /api/health`);
});

export default app;