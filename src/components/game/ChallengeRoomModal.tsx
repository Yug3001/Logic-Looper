/**
 * ChallengeRoomModal — 5-letter code room entry
 *
 * When a user clicks the share link or "Challenge Friend":
 *  - HOST: sees generated 5-letter code + link
 *  - GUEST: sees a code input box to type the 5-letter code
 *
 * Puzzle levels are chosen fresh per challenge (not tied to today's daily).
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './ChallengeRoomModal.css';

export type ChallengeLevel = {
    label: string;
    emoji: string;
    difficulty: number;
    type: string;
    description: string;
};

export const CHALLENGE_LEVELS: ChallengeLevel[] = [
    { label: 'Warm-Up', emoji: '🌱', difficulty: 0, type: 'sequence', description: 'Number sequences, easy patterns' },
    { label: 'Rookie',  emoji: '⚡', difficulty: 1, type: 'matrix',   description: '4×4 matrix, moderate gaps' },
    { label: 'Pro',     emoji: '🔥', difficulty: 2, type: 'binary',   description: '6×6 binary grid challenge' },
    { label: 'Expert',  emoji: '💀', difficulty: 3, type: 'deduction',description: 'Logic deduction, hard clues' },
];

interface Props {
    initialCode?: string;       // Pre-filled if guest clicked a link
    isGuest?: boolean;          // true → show "Join" mode by default
    onCreateRoom: (code: string, level: ChallengeLevel) => void;
    onJoinRoom: (code: string) => void;
    onClose: () => void;
}

export const ChallengeRoomModal: React.FC<Props> = ({
    initialCode = '',
    isGuest = false,
    onCreateRoom,
    onJoinRoom,
    onClose,
}) => {
    const [mode, setMode] = useState<'create' | 'join'>(isGuest ? 'join' : 'create');
    const [code, setCode] = useState(initialCode.toUpperCase());
    const [selectedLevel, setSelectedLevel] = useState<ChallengeLevel>(CHALLENGE_LEVELS[1]);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (mode === 'join') inputRef.current?.focus();
    }, [mode]);

    // Enforce 5-letter uppercase
    const handleCodeInput = (val: string) => {
        const clean = val.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 5);
        setCode(clean);
        setError('');
    };

    const handleCreate = () => {
        onCreateRoom(code, selectedLevel);
    };

    const handleJoin = () => {
        if (code.length !== 5) {
            setError('Please enter the full 5-letter room code.');
            return;
        }
        onJoinRoom(code);
    };

    // Close on Escape
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <AnimatePresence>
            <motion.div
                className="crm-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={e => e.target === e.currentTarget && onClose()}
            >
                <motion.div
                    className="crm-card"
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                >
                    {/* Header */}
                    <div className="crm-header">
                        <div className="crm-header-icon">⚔️</div>
                        <div>
                            <h2 className="crm-title">Challenge a Friend</h2>
                            <p className="crm-sub">Head-to-head puzzle battle</p>
                        </div>
                        <button className="crm-close" onClick={onClose} aria-label="Close">✕</button>
                    </div>

                    {/* Mode switcher */}
                    <div className="crm-tabs">
                        <button
                            className={`crm-tab ${mode === 'create' ? 'active' : ''}`}
                            onClick={() => setMode('create')}
                        >
                            🚀 Create Room
                        </button>
                        <button
                            className={`crm-tab ${mode === 'join' ? 'active' : ''}`}
                            onClick={() => setMode('join')}
                        >
                            🔑 Join with Code
                        </button>
                    </div>

                    <AnimatePresence mode="wait">
                        {/* ─── CREATE MODE ─────────────────────────────────── */}
                        {mode === 'create' && (
                            <motion.div
                                key="create"
                                className="crm-body"
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 12 }}
                            >
                                <p className="crm-section-label">Pick challenge level</p>
                                <div className="crm-levels">
                                    {CHALLENGE_LEVELS.map(level => (
                                        <motion.button
                                            key={level.label}
                                            className={`crm-level-card ${selectedLevel.label === level.label ? 'selected' : ''}`}
                                            onClick={() => setSelectedLevel(level)}
                                            whileHover={{ scale: 1.03 }}
                                            whileTap={{ scale: 0.97 }}
                                        >
                                            <span className="crml-emoji">{level.emoji}</span>
                                            <span className="crml-name">{level.label}</span>
                                            <span className="crml-desc">{level.description}</span>
                                            {selectedLevel.label === level.label && (
                                                <span className="crml-check">✓</span>
                                            )}
                                        </motion.button>
                                    ))}
                                </div>

                                <motion.button
                                    className="crm-btn-primary"
                                    onClick={handleCreate}
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.97 }}
                                >
                                    🚀 Create Room &amp; Get Code
                                </motion.button>
                            </motion.div>
                        )}

                        {/* ─── JOIN MODE ────────────────────────────────────── */}
                        {mode === 'join' && (
                            <motion.div
                                key="join"
                                className="crm-body"
                                initial={{ opacity: 0, x: 12 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -12 }}
                            >
                                <p className="crm-section-label">Enter the 5-letter room code</p>

                                <div className="crm-code-input-row">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className={`crm-code-box ${code[i] ? 'filled' : ''} ${i === code.length ? 'cursor' : ''}`}
                                        >
                                            {code[i] ?? ''}
                                        </div>
                                    ))}
                                </div>

                                {/* Hidden actual input */}
                                <input
                                    ref={inputRef}
                                    className="crm-hidden-input"
                                    value={code}
                                    onChange={e => handleCodeInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleJoin()}
                                    maxLength={5}
                                    autoCorrect="off"
                                    autoCapitalize="characters"
                                    spellCheck={false}
                                    placeholder="ENTER CODE"
                                />

                                {/* Tap to focus prompt */}
                                <button
                                    className="crm-tap-to-type"
                                    onClick={() => inputRef.current?.focus()}
                                >
                                    Tap here to type code
                                </button>

                                {error && (
                                    <motion.p
                                        className="crm-error"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                    >
                                        ⚠️ {error}
                                    </motion.p>
                                )}

                                <motion.button
                                    className="crm-btn-primary"
                                    onClick={handleJoin}
                                    disabled={code.length !== 5}
                                    whileHover={code.length === 5 ? { scale: 1.03 } : {}}
                                    whileTap={{ scale: 0.97 }}
                                >
                                    🎮 Join Room
                                </motion.button>

                                <p className="crm-hint-note">
                                    Ask your friend to share their 5-letter room code with you.
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ChallengeRoomModal;
