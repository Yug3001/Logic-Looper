/** Shared leaderboard types used by leaderboardLiveService and LeaderboardPage */

export interface PlayerSnap {
    socketId: string;
    userId: string;
    name: string;
    avatar: string | null;
    progress: number;
    hintsUsed: number;
    timeTaken: number;
    score: number | null;
    finished: boolean;
}

export interface RoomSnapshot {
    id: string;
    puzzleType: string;
    difficulty: number;
    mode: 'challenge' | 'solo';
    startedAt: number | null;
    players: PlayerSnap[];
    allFinished: boolean;
}
