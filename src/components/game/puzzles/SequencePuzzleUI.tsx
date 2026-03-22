import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SequencePuzzle } from '../../../lib/puzzleEngine';

interface Props {
    puzzle: SequencePuzzle;
    onChange: (answer: number) => void;
    disabled?: boolean;
}

const SequencePuzzleUI: React.FC<Props> = ({ puzzle, onChange, disabled }) => {
    const [selected, setSelected] = useState<number | null>(null);

    const handleSelect = (opt: number) => {
        if (disabled) return;
        setSelected(opt);
        onChange(opt);
    };

    return (
        <div className="puzzle-sequence">
            <p className="puzzle-instructions">
                Find the missing number that completes the pattern. Study the sequence carefully.
            </p>

            {/* Pattern rule hint badge */}
            <motion.div
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(139,92,246,0.1)',
                    border: '1px solid rgba(139,92,246,0.3)',
                    borderRadius: 999,
                    padding: '5px 14px',
                    fontSize: '0.78rem',
                    color: 'var(--accent-purple-light)',
                    fontWeight: 600,
                    alignSelf: 'center',
                }}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
            >
                🔑 Rule: {puzzle.rule}
            </motion.div>

            {/* Sequence display */}
            <div className="sequence-row">
                {puzzle.sequence.map((n, i) => (
                    <motion.div
                        key={i}
                        className="sequence-number"
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.08, type: 'spring', stiffness: 300, damping: 20 }}
                    >
                        {n}
                    </motion.div>
                ))}

                {/* Arrow */}
                <motion.span
                    className="sequence-arrow"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: puzzle.sequence.length * 0.08 }}
                >
                    →
                </motion.span>

                {/* Blank slot */}
                <motion.div
                    className="sequence-blank"
                    animate={selected !== null
                        ? { borderColor: 'var(--accent-purple)', boxShadow: '0 0 16px var(--accent-purple-glow)' }
                        : { borderColor: ['var(--accent-purple)', 'var(--accent-cyan)', 'var(--accent-purple)'] }
                    }
                    transition={{ duration: 2, repeat: selected !== null ? 0 : Infinity }}
                    initial={{ opacity: 0, scale: 0.5 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                >
                    {selected !== null ? selected : '?'}
                </motion.div>
            </div>

            {/* Options */}
            <div className="sequence-options">
                {puzzle.options.map((opt, i) => (
                    <motion.button
                        key={i}
                        className={`option-btn ${selected === opt ? 'option-selected' : ''}`}
                        onClick={() => handleSelect(opt)}
                        whileHover={!disabled && selected !== opt ? { scale: 1.06, y: -3 } : {}}
                        whileTap={!disabled ? { scale: 0.95 } : {}}
                        disabled={disabled}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + i * 0.07, type: 'spring', stiffness: 300, damping: 20 }}
                    >
                        {opt}
                    </motion.button>
                ))}
            </div>

            {/* Selection confirmation */}
            <AnimatePresence>
                {selected !== null && (
                    <motion.p
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        style={{ color: 'var(--accent-purple-light)', fontSize: '0.85rem', fontWeight: 600, textAlign: 'center' }}
                    >
                        ✓ You selected <strong>{selected}</strong> — submit when ready!
                    </motion.p>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SequencePuzzleUI;
