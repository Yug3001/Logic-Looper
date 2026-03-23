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
        label: 'Fixed increment',
        next: (n, _, arr) => n + (arr[1] - arr[0]),
        gen: (rng, s) => { const d = rng.int(3, 12); return Array.from({ length: 6 }, (_, i) => s + d * i); },
    },
    {
        label: 'Exponential growth',
        next: (n) => n * 2,
        gen: (rng, s) => { const f = rng.int(2, 4); return Array.from({ length: 6 }, (_, i) => s * Math.pow(f, i)); },
    },
    {
        label: 'Fibonacci-style sequence',
        next: (_, i, arr) => arr[i - 1] + arr[i - 2],
        gen: (rng, s) => {
            const a = [s, rng.int(s + 1, s + 4)];
            for (let i = 2; i < 6; i++) a.push(a[i - 1] + a[i - 2]);
            return a;
        },
    },
    {
        label: 'Perfect squares',
        next: (_, i) => (i + 1) * (i + 1),
        gen: (rng, s) => Array.from({ length: 6 }, (_, i) => (s + i) * (s + i)),
    },
    {
        label: 'Alternating delta (+ and -)',
        next: (n, i, arr) => {
            const d1 = arr[1] - arr[0];
            const d2 = arr[2] - arr[1];
            return i % 2 === 0 ? n + d1 : n + d2;
        },
        gen: (rng, s) => {
            const a = [s];
            const p = rng.int(4, 9);
            const d = -rng.int(1, 4);
            for (let i = 1; i < 6; i++) a.push(i % 2 === 1 ? a[i - 1] + p : a[i - 1] + d);
            return a;
        },
    },
    {
        label: 'Cubic progression',
        next: (_, i) => Math.pow(i + 1, 3),
        gen: (rng, s) => Array.from({ length: 6 }, (_, i) => Math.pow(s + i, 3)),
    },
    {
        label: 'Interleaved sequence (two series)',
        next: (_, i, arr) => arr[i - 2] + (arr[2] - arr[0]),
        gen: (rng, s) => {
            const a: number[] = [];
            let n1 = s;
            let n2 = rng.int(s + 5, s + 15);
            const d1 = rng.int(2, 5);
            const d2 = rng.int(10, 20);
            for (let i = 0; i < 6; i++) {
                if (i % 2 === 0) { a.push(n1); n1 += d1; }
                else { a.push(n2); n2 += d2; }
            }
            return a;
        }
    },
    {
        label: 'Prime-shifted sequence',
        next: (n, i) => n + [2, 3, 5, 7, 11, 13, 17, 19, 23][i],
        gen: (rng, s) => {
            const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23];
            const a = [s];
            for (let i = 0; i < 5; i++) a.push(a[i] + primes[i]);
            return a;
        }
    },
    {
        label: 'Alternating multiplication scaling',
        next: (n, i) => n * (i % 2 === 0 ? 2 : 3),
        gen: (rng, s) => {
            const a = [s];
            const f1 = rng.int(2, 3);
            const f2 = rng.int(4, 5);
            for (let i = 0; i < 5; i++) a.push(a[i] * (i % 2 === 0 ? f1 : f2));
            return a;
        }
    },
    {
        label: 'Growing difference cascade',
        next: (n, i) => n + i * i,
        gen: (rng, s) => {
            const a = [s];
            const base = rng.int(2, 5);
            for (let i = 1; i < 6; i++) a.push(a[i - 1] + i * base);
            return a;
        }
    }
];

function generateSequence(rng: ReturnType<typeof createRng>, difficulty: number): SequencePuzzle {
    const ruleIdx = rng.int(0, Math.min(difficulty + 2, SEQ_RULES.length - 1));
    const rule = SEQ_RULES[ruleIdx];
    const start = rng.int(1, 10);
    const seq = rule.gen(rng, start);
    const answer = seq[seq.length - 1];
    const visible = seq.slice(0, 4 + difficulty > 5 ? 4 : 4);

    // Generate wrong options that carefully mirror standard human error
    const variance = ruleIdx > 6 ? 12 : 5;
    const offsets = rng.shuffle([-variance, -(variance-2), -3, 3, (variance-2), variance, 9, -9, 2, -2]);
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
    // Determine deep logic mode depending on difficulty (0 = repeating, 1 = expanding, 2 = palindromic mirror)
    const mode = difficulty >= 2 ? rng.int(0, 2) : 0;
    
    let sequence: string[] = [];
    let answer = '';
    let rule = '';

    if (mode === 0) {
        const patternLen = 2 + difficulty;
        const pattern = Array.from({ length: patternLen }, () => rng.pick(symbolSet));
        for (let i = 0; i < 2; i++) sequence.push(...pattern);
        sequence.push(...pattern.slice(0, difficulty + 1));
        answer = pattern[(difficulty + 1) % patternLen];
        rule = `Cyclic pattern repeating every ${patternLen} items`;
    } else if (mode === 1) {
        const A = rng.pick(symbolSet);
        const B = rng.pick(symbolSet.filter(s => s !== A));
        let cur = 1;
        for (let i = 0; i < 4; i++) {
            sequence.push(A);
            for (let j = 0; j < cur; j++) sequence.push(B);
            cur++;
        }
        answer = sequence.pop()!;
        rule = `Expanding sequence cluster (+1 secondary item each loop)`;
    } else {
        const base = Array.from({ length: 3 }, () => rng.pick(symbolSet));
        const palindrome = [...base, ...[...base].reverse()];
        sequence = [...palindrome, ...palindrome.slice(0, 4)];
        answer = palindrome[4];
        rule = `Mirrored palindromic sequence`;
    }

    const options = rng.shuffle([
        answer,
        ...rng.shuffle(symbolSet.filter(s => s !== answer)).slice(0, 3),
    ]);

    return { type: 'pattern', items: sequence, answer, options, rule };
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

// ─── Deduction Grid ────────────────────────────────────────────────────────────
// More challenging logic with dynamically populated clues that form a solvable matrix.

const DEDUCTION_SCENARIOS = [
    { cat1: ['Alice', 'Bob', 'Charlie', 'Diana'], cat2: ['Math', 'Art', 'Science', 'History'] },
    { cat1: ['Red', 'Blue', 'Green', 'Yellow'], cat2: ['Apple', 'Berry', 'Grape', 'Banana'] },
    { cat1: ['Dog', 'Cat', 'Bird', 'Fish'], cat2: ['Bone', 'Yarn', 'Seed', 'Flake'] },
    { cat1: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'], cat2: ['Email', 'Call', 'Meeting', 'Review'] },
];

function generateDeduction(rng: ReturnType<typeof createRng>, difficulty: number): DeductionPuzzle {
    const size = difficulty >= 2 ? 4 : 3;
    const scenario = rng.pick(DEDUCTION_SCENARIOS);
    const cat1 = rng.shuffle([...scenario.cat1]).slice(0, size);
    const cat2 = rng.shuffle([...scenario.cat2]).slice(0, size);
    
    const solution: Record<string, string> = {};
    for (let i = 0; i < size; i++) {
        solution[cat1[i]] = cat2[i];
    }

    const solPairs = cat1.map((c1, i) => [c1, cat2[i]]);
    const clues: string[] = [];

    const addClue = (clue: string) => { if (!clues.includes(clue)) clues.push(clue); };

    // Deep associative logic
    if (difficulty >= 2) {
        addClue(`Neither ${solPairs[0][0]} nor ${solPairs[1][0]} is paired with ${solPairs[2][1]}.`);
        addClue(`The one paired with ${solPairs[1][1]} is not ${solPairs[0][0]}.`);
        addClue(`${solPairs[2][0]} is strictly paired with ${solPairs[2][1]}.`);
        addClue(`If you asked ${solPairs[3][0]}, they would say they don't have ${solPairs[1][1]} or ${solPairs[0][1]}.`);
        addClue(`By process of elimination involving ${solPairs[1][0]}, they must have ${solPairs[1][1]}.`);
    } else {
        addClue(`${solPairs[1][0]} pairs with ${solPairs[1][1]}.`);
        addClue(`${solPairs[0][0]} does NOT pair with ${solPairs[1][1]} or ${solPairs[2][1]}.`);
        addClue(`Therefore, ${solPairs[0][0]} must logically pair with ${solPairs[0][1]}.`);
    }

    const finalClues = rng.shuffle(clues);
    const categories = [cat1, cat2];
    const grid = Array.from({ length: size }, () => new Array(size).fill(false));

    return { type: 'deduction', clues: finalClues, categories, solution, grid };
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

    // Base score per difficulty: Easy→100, Medium→200, Hard→350, Expert→500
    const baseScore = [100, 200, 350, 500][Math.min(params.difficulty, 3)];

    // Time bonus: full bonus under 60s, decays linearly, zero bonus at 600s
    const timeBonus = Math.max(0, Math.round(baseScore * 0.5 * (1 - Math.min(params.timeTaken, 600) / 600)));

    // Hint penalty: each hint costs 15% of baseScore
    const hintPenalty = Math.round(baseScore * 0.15 * params.hintsUsed);

    return Math.max(10, baseScore + timeBonus - hintPenalty);
}
