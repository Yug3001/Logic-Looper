import { getDailyPuzzleConfig, generatePuzzle, validatePuzzle } from './src/lib/puzzleEngine.ts';
import { formatDateLocal } from './src/lib/db.ts';

async function runTests() {
    const typesToTest = new Set(['matrix', 'sequence', 'pattern', 'binary', 'deduction']);

    let validSoFar = true;
    for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const dateStr = formatDateLocal(d);

        const config = getDailyPuzzleConfig(dateStr);
        const puzzle = generatePuzzle(config);
        typesToTest.delete(puzzle.type);

        let answer;
        if (puzzle.type === 'matrix') answer = (puzzle as any).solution;
        else if (puzzle.type === 'sequence') answer = (puzzle as any).answer;
        else if (puzzle.type === 'pattern') answer = (puzzle as any).answer;
        else if (puzzle.type === 'binary') answer = (puzzle as any).solution;
        else if (puzzle.type === 'deduction') answer = (puzzle as any).solution;

        const valid = validatePuzzle(puzzle, answer);
        console.log(`[${dateStr}] Type: ${puzzle.type.padEnd(10)}, Difficulty: ${config.difficulty}, Valid? ${valid ? '✅' : '❌'}`);

        if (!valid) {
            console.error('Validation failed for actual answer:', answer);
            validSoFar = false;
            break;
        }

        if (typesToTest.size === 0) {
            break;
        }
    }
}

runTests();
