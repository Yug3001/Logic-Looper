/**
 * Score Validator — server-side mirror of client validation.
 * Prevents cheated scores from being stored.
 */

interface ScoreEntry {
    date: string;
    score: number;
    timeTaken: number;
    difficulty: number;
}

interface ValidationResult {
    valid: boolean;
    reason?: string;
}

const MIN_TIME: Record<number, number> = { 0: 15, 1: 20, 2: 30, 3: 45 };
const MAX_SCORE = 1400;
const MAX_TIME = 3600; // 1 hour

export function validateScoreEntry(entry: ScoreEntry): ValidationResult {
    // Score bounds
    if (entry.score < 0 || entry.score > MAX_SCORE) {
        return { valid: false, reason: `Score ${entry.score} out of range (0–${MAX_SCORE})` };
    }

    // Time bounds
    const minTime = MIN_TIME[entry.difficulty] ?? 15;
    if (entry.timeTaken < minTime) {
        return { valid: false, reason: `Time ${entry.timeTaken}s unrealistically fast for difficulty ${entry.difficulty}` };
    }
    if (entry.timeTaken > MAX_TIME) {
        return { valid: false, reason: `Time ${entry.timeTaken}s exceeds 1 hour maximum` };
    }

    // Date must be valid ISO
    const d = new Date(entry.date);
    if (isNaN(d.getTime())) {
        return { valid: false, reason: `Invalid date: ${entry.date}` };
    }

    // Date must not be in the future
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (d > today) {
        return { valid: false, reason: `Future date not allowed: ${entry.date}` };
    }

    // Difficulty must be 0–3
    if (![0, 1, 2, 3].includes(entry.difficulty)) {
        return { valid: false, reason: `Invalid difficulty: ${entry.difficulty}` };
    }

    return { valid: true };
}
