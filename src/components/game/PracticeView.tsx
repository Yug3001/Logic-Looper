import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { validatePuzzle, generateFreshPuzzle, AnyPuzzle, PuzzleType } from '../../lib/puzzleEngine';
import MatrixPuzzleUI from './puzzles/MatrixPuzzleUI';
import SequencePuzzleUI from './puzzles/SequencePuzzleUI';
import PatternPuzzleUI from './puzzles/PatternPuzzleUI';
import BinaryPuzzleUI from './puzzles/BinaryPuzzleUI';
import DeductionPuzzleUI from './puzzles/DeductionPuzzleUI';
import PuzzleTimer from './PuzzleTimer';
import './PracticeView.css';

const PUZZLE_TYPES = [
    { id: 'random', name: '🎲 Surprise Me (Random)', icon: '🎲' },
    { id: 'matrix', name: 'Number Matrix', icon: '🔢' },
    { id: 'sequence', name: 'Sequence Solver', icon: '📐' },
    { id: 'pattern', name: 'Pattern Matching', icon: '🎨' },
    { id: 'binary', name: 'Binary Logic', icon: '💻' },
    { id: 'deduction', name: 'Deduction Grid', icon: '🔍' },
];

const DIFFICULTIES = [
    { id: 0, name: 'Easy' },
    { id: 1, name: 'Medium' },
    { id: 2, name: 'Hard' },
    { id: 3, name: 'Expert' },
];

const PracticeView: React.FC = () => {
    const [selectedType, setSelectedType] = useState<string>('matrix');
    const [difficulty, setDifficulty] = useState<number>(0);
    const [puzzle, setPuzzle] = useState<AnyPuzzle | null>(null);
    const [userAnswer, setUserAnswer] = useState<any>(null);
    const [isSolved, setIsSolved] = useState(false);
    const [timeTaken, setTimeTaken] = useState(0);
    const [timerActive, setTimerActive] = useState(false);
    const [localError, setLocalError] = useState(false);
    const [puzzleId, setPuzzleId] = useState(0);

    const generateNew = React.useCallback(() => {
        let actualType: PuzzleType = selectedType as PuzzleType;
        if (selectedType === 'random') {
            const types: PuzzleType[] = ['matrix', 'sequence', 'pattern', 'binary', 'deduction'];
            actualType = types[Math.floor(Math.random() * types.length)];
        }
        // generateFreshPuzzle always produces a new unique puzzle (high-entropy seed)
        const newPuzzle = generateFreshPuzzle(actualType, difficulty as 0 | 1 | 2 | 3);
        setPuzzle(newPuzzle);
        setUserAnswer(null);
        setIsSolved(false);
        setTimeTaken(0);
        setTimerActive(false);
        setLocalError(false);
        setPuzzleId(prev => prev + 1);
    }, [selectedType, difficulty]);

    // Auto-generate on Mount AND when type/diff change so users aren't left looking at a game they didn't ask for!
    useEffect(() => {
        generateNew();
    }, [generateNew]);

    const handleAnswerChange = (ans: any) => {
        if (isSolved) return;
        setUserAnswer(ans);
        setLocalError(false);
        if (!timerActive) {
            setTimerActive(true);
        }
    };

    const checkSolution = () => {
        if (!puzzle || isSolved) return;

        const valid = validatePuzzle(puzzle, userAnswer);
        if (valid) {
            setIsSolved(true);
            setTimerActive(false);
            setLocalError(false);
        } else {
            setLocalError(true);
            setTimeout(() => setLocalError(false), 2000); // clear error flash
        }
    };

    return (
        <div className="practice-view">
            <header className="practice-header">
                <div>
                    <h1 className="practice-title">Freeplay Archive</h1>
                    <p className="practice-subtitle">Practice any game mode at your own pace without affecting your daily streak.</p>
                </div>

                <div className="practice-controls">
                    <div className="control-group">
                        <label>Puzzle Type</label>
                        <select value={selectedType} onChange={e => setSelectedType(e.target.value)}>
                            {PUZZLE_TYPES.map(t => (
                                <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="control-group">
                        <label>Difficulty</label>
                        <select value={difficulty} onChange={e => setDifficulty(Number(e.target.value))}>
                            {DIFFICULTIES.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </div>

                    <button className="btn-generate" onClick={generateNew}>
                        🔄 New Puzzle
                    </button>
                </div>
            </header>

            <div className={`practice-board ${isSolved ? 'solved-board' : ''}`}>
                <div className="board-header">
                    <span className="board-badge">
                        {puzzle ? PUZZLE_TYPES.find(t => t.id === puzzle.type)?.icon : ''} 
                        {puzzle ? PUZZLE_TYPES.find(t => t.id === puzzle.type)?.name : ''}
                    </span>
                    <PuzzleTimer active={timerActive && !isSolved} onTick={setTimeTaken} initialValue={0} />
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={`puzzle-${puzzleId}`}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="puzzle-wrapper"
                    >
                        {puzzle?.type === 'matrix' && <MatrixPuzzleUI puzzle={puzzle as any} onChange={handleAnswerChange} disabled={isSolved} />}
                        {puzzle?.type === 'sequence' && <SequencePuzzleUI puzzle={puzzle as any} onChange={handleAnswerChange} disabled={isSolved} />}
                        {puzzle?.type === 'pattern' && <PatternPuzzleUI puzzle={puzzle as any} onChange={handleAnswerChange} disabled={isSolved} />}
                        {puzzle?.type === 'binary' && <BinaryPuzzleUI puzzle={puzzle as any} onChange={handleAnswerChange} disabled={isSolved} />}
                        {puzzle?.type === 'deduction' && <DeductionPuzzleUI puzzle={puzzle as any} onChange={handleAnswerChange} disabled={isSolved} />}
                    </motion.div>
                </AnimatePresence>

                <div className="practice-actions">
                    <motion.button
                        className={`btn-check ${localError ? 'error-shake' : ''}`}
                        onClick={checkSolution}
                        disabled={isSolved || !userAnswer}
                        whileHover={!isSolved && userAnswer ? { scale: 1.05 } : {}}
                        whileTap={!isSolved && userAnswer ? { scale: 0.95 } : {}}
                    >
                        {isSolved ? '✅ Correct!' : 'Check Solution'}
                    </motion.button>
                </div>

                <AnimatePresence>
                    {isSolved && (
                        <motion.div
                            className="practice-success-overlay"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <h3>🎉 Brilliant!</h3>
                            <p>You solved this <b>{DIFFICULTIES.find(d => d.id === difficulty)?.name}</b> puzzle in <b>{timeTaken} seconds</b>.</p>
                            <button className="btn-generate primary" onClick={generateNew}>
                                Next Puzzle ➡
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default PracticeView;
