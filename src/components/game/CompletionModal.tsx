import React from 'react';
import { motion } from 'framer-motion';
import './CompletionModal.css';

interface Props {
    score: number;
    timeTaken: number;
    difficulty: number;
    hintsUsed: number;
    puzzleType: string;
    onClose: () => void;
}

const DIFF_LABEL = ['Easy', 'Medium', 'Hard', 'Expert'];
const DIFF_COLOR = ['#10B981', '#F59E0B', '#F97316', '#EF4444'];

const CompletionModal: React.FC<Props> = ({ score, timeTaken, difficulty, hintsUsed, puzzleType, onClose }) => {
    const m = Math.floor(timeTaken / 60);
    const s = timeTaken % 60;
    const isPerfect = score >= 950;
    const isGreat = score >= 700;

    const getMessage = () => {
        if (isPerfect) return { text: 'Perfect! 🌟', color: '#F9CA24' };
        if (isGreat) return { text: 'Great job! 🎉', color: '#10B981' };
        return { text: 'Puzzle Solved! ✅', color: '#7C3AED' };
    };
    const msg = getMessage();

    return (
        <motion.div
            className="completion-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className="completion-card"
                initial={{ scale: 0.7, y: 40, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                onClick={e => e.stopPropagation()}
            >
                <div className="completion-icon">
                    {isPerfect ? '🏆' : isGreat ? '🎉' : '✅'}
                </div>

                <h2 className="completion-title" style={{ color: msg.color }}>
                    {msg.text}
                </h2>

                <div className="completion-score">
                    <span className="score-number">{score.toLocaleString()}</span>
                    <span className="score-label">points</span>
                </div>

                <div className="completion-stats">
                    <div className="comp-stat">
                        <span className="comp-stat-icon">⏱</span>
                        <span className="comp-stat-val">{m}m {s}s</span>
                        <span className="comp-stat-label">Time</span>
                    </div>
                    <div className="comp-stat">
                        <span className="comp-stat-icon">🎯</span>
                        <span className="comp-stat-val" style={{ color: DIFF_COLOR[difficulty] }}>
                            {DIFF_LABEL[difficulty]}
                        </span>
                        <span className="comp-stat-label">Difficulty</span>
                    </div>
                    <div className="comp-stat">
                        <span className="comp-stat-icon">💡</span>
                        <span className="comp-stat-val">{hintsUsed}</span>
                        <span className="comp-stat-label">Hints</span>
                    </div>
                </div>

                <p className="completion-next">Come back tomorrow for a new puzzle! 🔥</p>

                <button className="btn-completion-close" onClick={onClose}>
                    View Analytics →
                </button>
            </motion.div>
        </motion.div>
    );
};

export default CompletionModal;
