/**
 * GameView — Daily Puzzle UI with Real-Time Challenge Support
 * Shows today's puzzle with timer, hints, completion flow,
 * and a side ChallengePanel for head-to-head battles.
 *
 * Features:
 *  - SHA-256 deterministic daily seed
 *  - Progress auto-save to IndexedDB (survives reload + offline)
 *  - Device date tamper detection
 *  - Daily streak strip (last 7 days)
 *  - Client-side solution validation & score calc
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    getDailyPuzzleConfigAsync,
    getDailyPuzzleConfig,
    generatePuzzle,
    validatePuzzle,
    calculateScore,
    AnyPuzzle,
    PuzzleConfig,
} from '../../lib/puzzleEngine';
import {
    formatDateLocal,
    savePuzzleProgress,
    getPuzzleProgress,
    clearPuzzleProgress,
} from '../../lib/db';
import { validateLocalDate } from '../../lib/syncService';
import { useHeatmap } from '../../hooks/useHeatmap';
import MatrixPuzzleUI from './puzzles/MatrixPuzzleUI';
import SequencePuzzleUI from './puzzles/SequencePuzzleUI';
import PatternPuzzleUI from './puzzles/PatternPuzzleUI';
import BinaryPuzzleUI from './puzzles/BinaryPuzzleUI';
import DeductionPuzzleUI from './puzzles/DeductionPuzzleUI';
import PuzzleTimer from './PuzzleTimer';
import CompletionModal from './CompletionModal';
import ChallengePanel from './ChallengePanel';
import DailyUnlockStrip from './DailyUnlockStrip';
import './GameView.css';

const DAILY_HINTS = 3;
const PUZZLE_TYPE_ICONS: Record<string, string> = {
    matrix: '🔢', sequence: '📐', pattern: '🎨', binary: '💻', deduction: '🔍',
};

// ─── Progress calculation (0–100) per puzzle type ────────────────────────────
function calcProgress(puzzle: AnyPuzzle, answer: any): number {
    if (answer === null || answer === undefined) return 0;
    try {
        switch (puzzle.type) {
            case 'matrix': {
                const grid = answer as number[][];
                const total = grid.length * grid[0].length;
                const filled = grid.flat().filter(v => v !== 0 && v !== null && v !== undefined).length;
                return Math.round((filled / total) * 100);
            }
            case 'binary': {
                const grid = answer as number[][];
                const total = grid.length * grid[0].length;
                const filled = grid.flat().filter(v => v !== -1 && v !== null && v !== undefined).length;
                return Math.round((filled / total) * 100);
            }
            case 'sequence':
            case 'pattern':
            case 'deduction':
                return answer !== null && answer !== '' ? 60 : 0;
            default:
                return 0;
        }
    } catch {
        return 0;
    }
}

const GameView: React.FC = () => {
    const today = formatDateLocal(new Date());

    // ── Async SHA-256 config ──────────────────────────────────────────────────
    const [config, setConfig] = useState<PuzzleConfig>(() => getDailyPuzzleConfig(today));
    const [configReady, setConfigReady] = useState(false);

    useEffect(() => {
        getDailyPuzzleConfigAsync(today).then(c => {
            setConfig(c);
            setConfigReady(true);
        }).catch(() => {
            // Fallback already set
            setConfigReady(true);
        });
    }, [today]);

    const puzzle = useMemo(() => generatePuzzle(config), [config]);

    const { activityMap, recordSolve } = useHeatmap();
    const todayActivity = activityMap.get(today);
    const alreadySolved = todayActivity?.solved ?? false;

    const [userAnswer, setUserAnswer] = useState<any>(null);
    const [hintsUsed, setHintsUsed] = useState(0);
    const [hintsOpen, setHintsOpen] = useState(false);
    const [timeTaken, setTimeTaken] = useState(0);
    const [timerActive, setTimerActive] = useState(false);
    const [showCompletion, setShowCompletion] = useState(false);
    const [lastScore, setLastScore] = useState(todayActivity?.score ?? 0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [dateWarning, setDateWarning] = useState<string | null>(null);

    // Restored-from-save flag to avoid triggering timer on silent restore
    const [progressRestored, setProgressRestored] = useState(false);
    const firstInteraction = useRef(false);

    // ── Challenge state ────────────────────────────────────────────────────────
    const [challengeActive, setChallengeActive] = useState(false);
    const progressEmitterRef = useRef<((p: number, h: number, t: number) => void) | null>(null);
    const completeEmitterRef = useRef<((s: number, t: number, h: number, c: boolean) => void) | null>(null);

    // ── Validate device date (anti-cheat) ─────────────────────────────────────
    useEffect(() => {
        validateLocalDate().then(result => {
            if (!result.valid) {
                setDateWarning(result.reason ?? 'Device time appears to have been manipulated.');
            }
        });
    }, []);

    // ── Restore progress from IndexedDB on mount ──────────────────────────────
    useEffect(() => {
        if (alreadySolved) return; // Already done, nothing to restore

        getPuzzleProgress(today).then(saved => {
            if (!saved) return;
            // Only restore if saved within last 24h
            const savedAgo = Date.now() - new Date(saved.savedAt).getTime();
            if (savedAgo > 86_400_000) return;

            setHintsUsed(saved.hintsUsed);
            setTimeTaken(saved.timeTaken);
            if (saved.answer !== null && saved.answer !== undefined) {
                setUserAnswer(saved.answer);
                setProgressRestored(true);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [today]); // Only run once on mount

    // ── Auto-save progress whenever answer/hints/time change ──────────────────
    const saveProgressDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => {
        if (alreadySolved || !configReady) return;
        if (userAnswer === null && hintsUsed === 0) return;

        clearTimeout(saveProgressDebounceRef.current);
        saveProgressDebounceRef.current = setTimeout(() => {
            savePuzzleProgress({
                date: today,
                answer: userAnswer,
                hintsUsed,
                timeTaken,
                savedAt: new Date().toISOString(),
            });
        }, 800); // debounce 800ms

        return () => clearTimeout(saveProgressDebounceRef.current);
    }, [userAnswer, hintsUsed, timeTaken, today, alreadySolved, configReady]);

    // ── Start timer on first real interaction ─────────────────────────────────
    const handleFirstInteraction = useCallback(() => {
        if (!firstInteraction.current && !alreadySolved) {
            firstInteraction.current = true;
            setTimerActive(true);
        }
    }, [alreadySolved]);

    // ── If today already solved → show result state ───────────────────────────
    useEffect(() => {
        if (alreadySolved) {
            setTimerActive(false);
            setTimeTaken(todayActivity?.timeTaken ?? 0);
        }
    }, [alreadySolved, todayActivity]);

    // ── Check URL for challenge params on mount ───────────────────────────────
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('challenge')) setChallengeActive(true);
    }, []);

    // ── Emit live progress to ChallengePanel ──────────────────────────────────
    useEffect(() => {
        if (!challengeActive || alreadySolved) return;
        const progress = calcProgress(puzzle, userAnswer);
        progressEmitterRef.current?.(progress, hintsUsed, timeTaken);
    }, [userAnswer, hintsUsed, timeTaken, challengeActive, puzzle, alreadySolved]);

    const handleUserAnswer = useCallback((answer: any) => {
        handleFirstInteraction();
        setUserAnswer(answer);
    }, [handleFirstInteraction]);

    const handleUseHint = useCallback(() => {
        if (hintsUsed < DAILY_HINTS) {
            handleFirstInteraction();
            setHintsUsed(h => h + 1);
            setHintsOpen(true);
        }
    }, [hintsUsed, handleFirstInteraction]);

    const handleSubmit = useCallback(async () => {
        // Anti-cheat: check device date before accepting submission
        const dateCheck = await validateLocalDate();
        if (!dateCheck.valid) {
            setSubmitError(dateCheck.reason ?? 'Invalid device time.');
            return;
        }

        const correct = validatePuzzle(puzzle, userAnswer);
        const score = calculateScore({
            difficulty: config.difficulty,
            timeTaken,
            hintsUsed,
            correct,
        });

        setIsSubmitting(true);
        setSubmitError(null);

        // ── Save to IndexedDB ──
        const result = await recordSolve({
            score,
            timeTaken,
            difficulty: config.difficulty,
            puzzleType: config.type,
            hintsUsed,
        });

        setIsSubmitting(false);

        if (!result.success) {
            setSubmitError(result.error ?? 'Failed to record solve');
            return;
        }

        // ── Clear saved progress (puzzle is done) ──
        await clearPuzzleProgress(today);

        // ── Notify challenge opponent ──
        completeEmitterRef.current?.(score, timeTaken, hintsUsed, correct);

        setLastScore(score);
        setTimerActive(false);
        setShowCompletion(true);
    }, [puzzle, userAnswer, config, timeTaken, hintsUsed, recordSolve, today]);

    const difficultyLabel = ['Easy', 'Medium', 'Hard', 'Expert'][config.difficulty];
    const difficultyColor = ['#10B981', '#F59E0B', '#F97316', '#EF4444'][config.difficulty];

    const getHintText = (): string => {
        switch (puzzle.type) {
            case 'sequence': return `Hint: ${(puzzle as any).rule}`;
            case 'pattern': return `Hint: ${(puzzle as any).rule}`;
            case 'matrix': return `Hint: Each row and column must contain all numbers 1–${(puzzle as any).size}`;
            case 'binary': return 'Hint: No 3 consecutive same digits in any row or column. Equal 0s and 1s per row/column.';
            case 'deduction': return `Hint: Read clue #${hintsUsed}: "${(puzzle as any).clues[Math.min(hintsUsed - 1, (puzzle as any).clues.length - 1)]}"`;
            default: return 'Think carefully!';
        }
    };

    return (
        <div className="game-view">
            {/* ── Device Date Warning ── */}
            {dateWarning && (
                <motion.div
                    className="date-warning-banner"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    ⚠️ {dateWarning}
                </motion.div>
            )}

            {/* ── Daily Unlock Strip (last 7 days) ── */}
            <DailyUnlockStrip activityMap={activityMap} today={today} />

            {/* Header */}
            <motion.div
                className="game-header"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="game-header-left">
                    <div className="puzzle-type-badge">
                        <span>{PUZZLE_TYPE_ICONS[config.type]}</span>
                        <span>{config.type.charAt(0).toUpperCase() + config.type.slice(1)}</span>
                    </div>
                    <div
                        className="difficulty-badge"
                        style={{ background: difficultyColor + '22', color: difficultyColor, border: `1px solid ${difficultyColor}44` }}
                    >
                        {difficultyLabel}
                    </div>
                    {progressRestored && !alreadySolved && (
                        <div className="restored-badge" title="Progress restored from your last session">
                            💾 Restored
                        </div>
                    )}
                </div>
                <div className="game-header-center">
                    <h1 className="game-title">Puzzle #{Math.ceil((new Date(today).getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000)}</h1>
                    <div className="game-date">{new Date(today).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                </div>
                <div className="game-header-right">
                    <PuzzleTimer
                        active={timerActive}
                        onTick={setTimeTaken}
                        initialValue={alreadySolved ? todayActivity?.timeTaken ?? 0 : timeTaken}
                    />
                    {/* Challenge toggle button */}
                    {!alreadySolved && (
                        <motion.button
                            className={`btn-challenge-toggle ${challengeActive ? 'active' : ''}`}
                            onClick={() => setChallengeActive(v => !v)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            title="Challenge a friend"
                        >
                            ⚔️
                        </motion.button>
                    )}
                </div>
            </motion.div>

            {/* Already Solved Banner */}
            {alreadySolved && (
                <motion.div
                    className="solved-banner"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <span>✅</span>
                    <div>
                        <strong>Already solved today!</strong>
                        <p>Score: <span className="score-highlight">{todayActivity?.score.toLocaleString()} pts</span> · Time: {Math.floor((todayActivity?.timeTaken ?? 0) / 60)}m {(todayActivity?.timeTaken ?? 0) % 60}s</p>
                    </div>
                    <span className="solved-badge">Come back tomorrow 🔥</span>
                </motion.div>
            )}

            {/* Main layout: puzzle + (optional) challenge panel */}
            <div className={`game-body ${challengeActive ? 'with-challenge' : ''}`}>
                {/* Left: Puzzle Area */}
                <div className="game-main">
                    <motion.div
                        className="puzzle-area"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        {puzzle.type === 'matrix' && (
                            <MatrixPuzzleUI puzzle={puzzle as any} onChange={handleUserAnswer} disabled={alreadySolved} />
                        )}
                        {puzzle.type === 'sequence' && (
                            <SequencePuzzleUI puzzle={puzzle as any} onChange={handleUserAnswer} disabled={alreadySolved} />
                        )}
                        {puzzle.type === 'pattern' && (
                            <PatternPuzzleUI puzzle={puzzle as any} onChange={handleUserAnswer} disabled={alreadySolved} />
                        )}
                        {puzzle.type === 'binary' && (
                            <BinaryPuzzleUI puzzle={puzzle as any} onChange={handleUserAnswer} disabled={alreadySolved} />
                        )}
                        {puzzle.type === 'deduction' && (
                            <DeductionPuzzleUI puzzle={puzzle as any} onChange={handleUserAnswer} disabled={alreadySolved} />
                        )}
                    </motion.div>

                    {/* Controls */}
                    {!alreadySolved && (
                        <motion.div
                            className="game-controls"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            {/* Hints */}
                            <button
                                className="btn-hint"
                                onClick={handleUseHint}
                                disabled={hintsUsed >= DAILY_HINTS}
                            >
                                💡 Hint ({DAILY_HINTS - hintsUsed} left)
                            </button>

                            {/* Submit */}
                            <button
                                className="btn-submit"
                                onClick={handleSubmit}
                                disabled={userAnswer === null || isSubmitting}
                            >
                                {isSubmitting ? (
                                    <span className="btn-spinner">⟳ Checking…</span>
                                ) : (
                                    '✅ Submit Answer'
                                )}
                            </button>
                        </motion.div>
                    )}

                    {/* Error */}
                    {submitError && (
                        <div className="submit-error">⚠️ {submitError}</div>
                    )}

                    {/* Hint Tooltip */}
                    <AnimatePresence>
                        {hintsOpen && hintsUsed > 0 && (
                            <motion.div
                                className="hint-popup"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                            >
                                <div className="hint-popup-header">
                                    <span>💡 Hint {hintsUsed}/{DAILY_HINTS}</span>
                                    <button onClick={() => setHintsOpen(false)}>✕</button>
                                </div>
                                <p className="hint-popup-text">{getHintText()}</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Right: Challenge Panel */}
                <AnimatePresence>
                    {challengeActive && (
                        <motion.div
                            className="game-challenge-sidebar"
                            initial={{ opacity: 0, x: 40, width: 0 }}
                            animate={{ opacity: 1, x: 0, width: 'auto' }}
                            exit={{ opacity: 0, x: 40, width: 0 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                        >
                            <ChallengePanel
                                puzzleType={config.type}
                                difficulty={config.difficulty}
                                onChallengeStart={() => { }}
                                onChallengeEnd={() => setChallengeActive(false)}
                                onRegisterProgressEmitter={(fn) => { progressEmitterRef.current = fn; }}
                                onRegisterCompleteEmitter={(fn) => { completeEmitterRef.current = fn; }}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Completion Modal */}
            <AnimatePresence>
                {showCompletion && (
                    <CompletionModal
                        score={lastScore}
                        timeTaken={timeTaken}
                        difficulty={config.difficulty}
                        hintsUsed={hintsUsed}
                        puzzleType={config.type}
                        onClose={() => setShowCompletion(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default GameView;
