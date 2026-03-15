import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

export interface JwtPayload {
    userId: string;
    email: string;
    iat?: number;
    exp?: number;
}

export function signToken(payload: { userId: string; email: string }): string {
    return jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
    return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
}

// Express middleware — attaches user to req if token present
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid Authorization header' });
        return;
    }
    try {
        const token = authHeader.slice(7);
        const payload = verifyToken(token);
        (req as any).user = payload;
        next();
    } catch {
        res.status(401).json({ error: 'Token expired or invalid' });
    }
}

// Optional auth — doesn't block, just attaches user if present
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        try {
            const token = authHeader.slice(7);
            (req as any).user = verifyToken(token);
        } catch { /* ignore */ }
    }
    next();
}
