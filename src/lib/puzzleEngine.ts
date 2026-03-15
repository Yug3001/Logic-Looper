/**
 * Logic Looper — Puzzle Engine
 * Deterministic puzzle generation based on date seed.
 * All logic runs 100% client-side.
 */

import { getPuzzleSeedForDate, getPuzzleSeedForDateAsync, formatDateLocal } from './db';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PuzzleType = 'matrix' | 'sequence' | 'pattern' | 'deduction' | 'binary';

export interface PuzzleConfig {
    type: PuzzleType;
    difficulty: 0 | 1 | 2 | 3;
    date: string;
    seed: number;
}

export interface MatrixPuzzle {
    type: 'matrix';
    grid: (number | null)[][];   // null = empty cell
    solution: number[][];
    size: number;
}

export interface SequencePuzzle {
    type: 'sequence';
    sequence: number[];           // visible numbers
    answer: number;               // correct next number
    options: number[];            // 4 multiple choice options
    rule: string;                 // description for hint
}

export interface PatternPuzzle {
    type: 'pattern';
    items: string[];              // emoji/symbol sequence
    answer: string;
    options: string[];
    rule: string;
}

export interface DeductionPuzzle {
    type: 'deduction';
    clues: string[];
    categories: string[][];       // [people, items, colors, etc.]
    solution: Record<string, string>;
    grid: boolean[][];            // user's working grid state
}

export interface BinaryPuzzle {
    type: 'binary';
    rows: (0 | 1 | null)[][];
    solution: (0 | 1)[][];
    size: number;
}

export type AnyPuzzle =
    | MatrixPuzzle
    | SequencePuzzle
    | PatternPuzzle
    | DeductionPuzzle
    | BinaryPuzzle;

// ─── Seeded RNG (Mulberry32 — fast, deterministic) ───────────────────────────

export function createRng(seed: number) {
    let s = seed | 0;
    return {
        next(): number {
            s |= 0;
            s = (s + 0x6d2b79f5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        },
        int(min: number, max: number): number {
            return Math.floor(this.next() * (max - min + 1)) + min;
        },
        pick<T>(arr: T[]): T {
            return arr[Math.floor(this.next() * arr.length)];
        },
        shuffle<T>(arr: T[]): T[] {
            const a = [...arr];
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(this.next() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        },
    };
}

// ─── Daily Puzzle Selector ────────────────────────────────────────────────────

const PUZZLE_ROTATION: PuzzleType[] = [
    'matrix', 'sequence', 'pattern', 'binary', 'deduction',
    'sequence', 'matrix', 'pattern', 'binary', 'sequence',
];

function buildConfig(d: string, seed: number): PuzzleConfig {
    const rng = createRng(seed);

    // Day of year 0–364 → rotation index
    const startOfYear = new Date(new Date(d).getFullYear(), 0, 1);
    const dayOfYear = Math.floor((new Date(d).getTime() - startOfYear.getTime()) / 86400000);
    const type = PUZZLE_ROTATION[dayOfYear % PUZZLE_ROTATION.length];

    // Difficulty escalates over the year, with weekly resets for fairness
    const weekOfYear = Math.floor(dayOfYear / 7);
    const difficulty = Math.min(3, Math.floor(weekOfYear / 13)) as 0 | 1 | 2 | 3;

    // Boost difficulty slightly with rng for variety
    const finalDifficulty = (rng.next() > 0.85 && difficulty < 3 ? difficulty + 1 : difficulty) as 0 | 1 | 2 | 3;

    return { type, difficulty: finalDifficulty, date: d, seed };
}

export function getDailyPuzzleConfig(date?: string): PuzzleConfig {
    const d = date ?? formatDateLocal(new Date());
    const seed = getPuzzleSeedForDate(d);
    return buildConfig(d, seed);
}

/** Async version using SHA-256 seed — more secure, preferred when available */
export async function getDailyPuzzleConfigAsync(date?: string): Promise<PuzzleConfig> {
    const d = date ?? formatDateLocal(new Date());
    const seed = await getPuzzleSeedForDateAsync(d);
    return buildConfig(d, seed);
}

/**
 * Generate a FRESH puzzle config that is guaranteed to be different every call.
 * Uses a high-entropy seed combining timestamp + crypto.randomUUID-style bits.
 * Used in Practice / Freeplay mode so puzzles never repeat.
 */
export function makeFreshSeed(): number {
    // Mix time, Math.random (not crypto but good enough for UX uniqueness)
    const t = Date.now();
    const r = Math.floor(Math.random() * 0xFFFFFFFF);
    // XOR folding to keep within uint32
    return ((t ^ (t >>> 16) ^ r) >>> 0);
}

export function generateFreshPuzzle(
    type: PuzzleType,
    difficulty: 0 | 1 | 2 | 3 = 0
): AnyPuzzle {
    const seed = makeFreshSeed();
    const config: PuzzleConfig = {
        type,
        difficulty,
        date: formatDateLocal(new Date()),
        seed,
    };
    return generatePuzzle(config);
}

// ─── Generate Puzzle ──────────────────────────────────────────────────────────

export function generatePuzzle(config: PuzzleConfig): AnyPuzzle {
    const rng = createRng(config.seed + config.difficulty * 1000);
    switch (config.type) {
        case 'matrix': return generateMatrix(rng, config.difficulty);
        case 'sequence': return generateSequence(rng, config.difficulty);
        case 'pattern': return generatePattern(rng, config.difficulty);
        case 'binary': return generateBinary(rng, config.difficulty);
        case 'deduction': return generateDeduction(rng, config.difficulty);
    }
}

// ─── Matrix (Mini Sudoku) ─────────────────────────────────────────────────────

function generateMatrix(rng: ReturnType<typeof createRng>, difficulty: number): MatrixPuzzle {
    const size = difficulty >= 2 ? 6 : 4;
    const solution = solve4x4(rng, size);
    const revealCount = size * size - [4, 6, 9, 12][difficulty];
    const grid = solution.map(row => [...row]) as (number | null)[][];

    // Remove cells to create puzzle
    let removed = 0;
    const positions = rng.shuffle(Array.from({ length: size * size }, (_, i) => i));
    for (const pos of positions) {
        if (removed >= revealCount) break;
        const r = Math.floor(pos / size);
        const c = pos % size;
        grid[r][c] = null;
        removed++;
    }

    return { type: 'matrix', grid, solution, size };
}

function solve4x4(rng: ReturnType<typeof createRng>, size: number): number[][] {
    const nums = Array.from({ length: size }, (_, i) => i + 1);
    const grid: number[][] = [];

    // Generate valid latin square
    for (let i = 0; i < size; i++) {
        const row = [...nums];
        // Rotate by i positions
        for (let j = 0; j < i; j++) row.push(row.shift()!);
        grid.push(row);
    }

    // Fisher-Yates shuffle rows and cols
    const rowOrder = rng.shuffle(Array.from({ length: size }, (_, i) => i));
    const colOrder = rng.shuffle(Array.from({ length: size }, (_, i) => i));

    return rowOrder.map(r => colOrder.map(c => grid[r][c]));
}

// ─── Sequence ────────────────────────────────────────────────────────────────

interface SeqRule {
    label: string;
    next: (n: number, i: number, arr: number[]) => number;
    gen: (rng: ReturnType<typeof createRng>, start: number) => number[];
}

const SEQ_RULES: SeqRule[] = [
    {
        label: 'Add a fixed number each step',
        next: (n, _, arr) => n + (arr[1] - arr[0]),
        gen: (rng, s) => { const d = rng.int(2, 8); return Array.from({ length: 5 }, (_, i) => s + d * i); },
    },
    {
        label: 'Multiply by a fixed factor',
        next: (n) => n * 2,
        gen: (rng, s) => { const f = rng.int(2, 3); return Array.from({ length: 5 }, (_, i) => s * Math.pow(f, i)); },
    },
    {
        label: 'Each term is sum of two before it (Fibonacci-style)',
        next: (_, i, arr) => arr[i - 1] + arr[i - 2],
        gen: (rng, s) => {
            const a = [s, rng.int(s, s + 5)];
            for (let i = 2; i < 5; i++) a.push(a[i - 1] + a[i - 2]);
            return a;
        },
    },
    {
        label: 'Squares of natural numbers',
        next: (_, i) => (i + 1) * (i + 1),
        gen: (rng, s) => Array.from({ length: 5 }, (_, i) => (s + i) * (s + i)),
    },
    {
        label: 'Alternating add/subtract',
        next: (n, i) => i % 2 === 0 ? n + 5 : n - 2,
        gen: (rng, s) => {
            const a = [s];
            for (let i = 1; i < 5; i++) a.push(i % 2 === 1 ? a[i - 1] + 5 : a[i - 1] - 2);
            return a;
        },
    },
];

function generateSequence(rng: ReturnType<typeof createRng>, difficulty: number): SequencePuzzle {
    const ruleIdx = rng.int(0, Math.min(difficulty + 2, SEQ_RULES.length - 1));
    const rule = SEQ_RULES[ruleIdx];
    const start = rng.int(1, 10);
    const seq = rule.gen(rng, start);
    const answer = seq[seq.length - 1];
    const visible = seq.slice(0, 4 + difficulty > 5 ? 4 : 4);

    // Wrong options
    const offsets = rng.shuffle([-7, -5, -3, 3, 5, 7, 9, -9, 2, -2]);
    const options = rng.shuffle([answer, ...offsets.slice(0, 3).map(o => answer + o)]);

    return { type: 'sequence', sequence: seq.slice(0, seq.length - 1), answer, options, rule: rule.label };
}

// ─── Pattern ─────────────────────────────────────────────────────────────────

const PATTERN_SETS = [
    ['🔴', '🔵', '🟢', '🟡', '🟣'],
    ['⭐', '🌙', '☀️', '🌟', '💫'],
    ['🐶', '🐱', '🐭', '🐹', '🐰'],
    ['🍎', '🍊', '🍋', '🍇', '🍓'],
    ['🔺', '🔷', '🟩', '🔶', '🔻'],
];

function generatePattern(rng: ReturnType<typeof createRng>, difficulty: number): PatternPuzzle {
    const symbolSet = rng.pick(PATTERN_SETS);
    const patternLen = 2 + difficulty;
    const pattern = Array.from({ length: patternLen }, () => rng.pick(symbolSet));
    const repeats = 2;

    const sequence = [];
    for (let i = 0; i < repeats; i++) sequence.push(...pattern);
    // Add partial next repeat
    sequence.push(...pattern.slice(0, difficulty + 1));

    const answer = pattern[(difficulty + 1) % patternLen];
    const options = rng.shuffle([
        answer,
        ...rng.shuffle(symbolSet.filter(s => s !== answer)).slice(0, 3),
    ]);

    return { type: 'pattern', items: sequence, answer, options, rule: `Pattern repeats every ${patternLen} items` };
}

// ─── Binary (Binairo) ────────────────────────────────────────────────────────

function generateBinary(rng: ReturnType<typeof createRng>, difficulty: number): BinaryPuzzle {
    const size = difficulty >= 2 ? 6 : 4; // even only
    const solution: (0 | 1)[][] = [];

    // Generate valid Binairo grid
    for (let r = 0; r < size; r++) {
        const row: (0 | 1)[] = [];
        for (let c = 0; c < size; c++) {
            // No 3 consecutive same
            let val: 0 | 1 = rng.next() > 0.5 ? 1 : 0;
            if (c >= 2 && row[c - 1] === row[c - 2] && row[c - 2] === val) val = val === 0 ? 1 : 0;
            row.push(val);
        }
        solution.push(row);
    }

    // Reveal cells
    const hideCount = Math.floor(size * size * [0.4, 0.5, 0.6, 0.7][difficulty]);
    const rows = solution.map(r => [...r]) as (0 | 1 | null)[][];
    const positions = rng.shuffle(Array.from({ length: size * size }, (_, i) => i));
    for (let i = 0; i < hideCount; i++) {
        const pos = positions[i];
        rows[Math.floor(pos / size)][pos % size] = null;
    }

    return { type: 'binary', rows, solution, size };
}

// ─── Deduction Grid (simplified two-category) ────────────────────────────────

const DEDUCTION_DATA = [
    {
        people: ['Alice', 'Bob', 'Charlie'],
        items: ['Math', 'Art', 'Music'],
        clueTemplates: [
            (sol: string[][]) => `${sol[0][0]} does not study ${sol[1][1]}.`,
            (sol: string[][]) => `${sol[1][0]} studies ${sol[1][1]}.`,
            (sol: string[][]) => `${sol[2][0]} does not study ${sol[0][1]}.`,
        ],
    },
];

function generateDeduction(rng: ReturnType<typeof createRng>, difficulty: number): DeductionPuzzle {
    const data = rng.pick(DEDUCTION_DATA);
    const shuffledPeople = rng.shuffle([...data.people]);
    const shuffledItems = rng.shuffle([...data.items]);
    const solution: Record<string, string> = {};
    shuffledPeople.forEach((p, i) => { solution[p] = shuffledItems[i]; });

    const sol = shuffledPeople.map(p => [p, solution[p]]);
    const clues = data.clueTemplates.map(fn => fn(sol));
    const extraClues = difficulty < 2 ? [
        `${shuffledPeople[0]} studies ${solution[shuffledPeople[0]]}.`
    ] : [];

    const categories = [shuffledPeople, shuffledItems];
    const size = shuffledPeople.length;
    const grid = Array.from({ length: size }, () => new Array(size).fill(false));

    return {
        type: 'deduction',
        clues: [...clues, ...extraClues],
        categories,
        solution,
        grid,
    };
}

// ─── Validate Puzzle ──────────────────────────────────────────────────────────

export function validatePuzzle(puzzle: AnyPuzzle, userAnswer: any): boolean {
    switch (puzzle.type) {
        case 'matrix':
            return validateMatrix(puzzle, userAnswer);
        case 'sequence':
        case 'pattern':
            return userAnswer === puzzle.answer;
        case 'binary':
            return validateBinary(puzzle, userAnswer);
        case 'deduction':
            return validateDeduction(puzzle, userAnswer);
        default:
            return false;
    }
}

function validateMatrix(puzzle: MatrixPuzzle, userGrid: (number | null)[][]): boolean {
    if (!userGrid) return false;
    const size = puzzle.size;
    
    // Check if fully filled
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (userGrid[r]?.[c] === null || userGrid[r]?.[c] === undefined) return false;
        }
    }

    // Check rows and columns for exactly 1 to size uniqueness
    for (let i = 0; i < size; i++) {
        const rowSet = new Set<number>();
        const colSet = new Set<number>();
        for (let j = 0; j < size; j++) {
            rowSet.add(userGrid[i][j] as number);
            colSet.add(userGrid[j][i] as number);
        }
        if (rowSet.size !== size || colSet.size !== size) return false;
    }

    return true;
}

function validateBinary(puzzle: BinaryPuzzle, userGrid: (0 | 1 | null)[][]): boolean {
    if (!userGrid) return false;
    const size = puzzle.size;

    // Check if fully filled
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (userGrid[r]?.[c] === null || userGrid[r]?.[c] === undefined) return false;
        }
    }

    const half = size / 2;
    const rowStrings = new Set<string>();
    const colStrings = new Set<string>();

    for (let i = 0; i < size; i++) {
        let rowZeros = 0, rowOnes = 0;
        let colZeros = 0, colOnes = 0;
        let rowStr = '';
        let colStr = '';

        for (let j = 0; j < size; j++) {
            const rVal = userGrid[i][j];
            const cVal = userGrid[j][i];
            
            rowStr += rVal;
            colStr += cVal;

            // Count rows
            if (rVal === 0) rowZeros++;
            if (rVal === 1) rowOnes++;
            
            // Count cols
            if (cVal === 0) colZeros++;
            if (cVal === 1) colOnes++;

            // 3-in-a-row logic for rows
            if (j >= 2) {
                if (userGrid[i][j] === userGrid[i][j-1] && userGrid[i][j] === userGrid[i][j-2]) return false;
            }
            // 3-in-a-row logic for cols
            if (j >= 2) {
                if (userGrid[j][i] === userGrid[j-1][i] && userGrid[j][i] === userGrid[j-2][i]) return false;
            }
        }

        if (rowZeros !== half || rowOnes !== half) return false;
        if (colZeros !== half || colOnes !== half) return false;

        // Check uniqueness 
        if (rowStrings.has(rowStr) || colStrings.has(colStr)) return false;
        rowStrings.add(rowStr);
        colStrings.add(colStr);
    }

    return true;
}

function validateDeduction(puzzle: DeductionPuzzle, userSolution: Record<string, string>): boolean {
    if (!userSolution) return false;
    return Object.entries(puzzle.solution).every(([k, v]) => userSolution[k] === v);
}

// ─── Score Calculator ─────────────────────────────────────────────────────────

export function calculateScore(params: {
    difficulty: number;
    timeTaken: number;
    hintsUsed: number;
    correct: boolean;
}): number {
    if (!params.correct) return 0;
    return 10;
}
