import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { DeductionPuzzle } from '../../../lib/puzzleEngine';

interface Props {
    puzzle: DeductionPuzzle;
    onChange: (solution: Record<string, string>) => void;
    disabled?: boolean;
}

const DeductionPuzzleUI: React.FC<Props> = ({ puzzle, onChange, disabled }) => {
    const [assignments, setAssignments] = useState<Record<string, string>>({});
    const people = puzzle.categories[0];
    const items = puzzle.categories[1];

    const assign = (person: string, item: string) => {
        if (disabled) return;
        // Toggle off if already selected
        const newAssign = assignments[person] === item
            ? { ...assignments, [person]: '' }
            : { ...assignments, [person]: item };
        setAssignments(newAssign);
        onChange(newAssign);
    };

    const solved = people.every(p => assignments[p] && assignments[p].length > 0);
    const conflictingItems = Object.values(assignments).filter(v => v);

    return (
        <div className="puzzle-deduction">
            <p className="puzzle-instructions">
                Use the logical clues below to find the unique pairing for each item.
            </p>

            {/* Clue panel */}
            <div className="deduction-clues">
                <h3 className="clues-title">🔍 Logical Clues</h3>
                {puzzle.clues.map((clue, i) => (
                    <motion.div
                        key={i}
                        className="clue-item"
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07, type: 'spring', stiffness: 300, damping: 25 }}
                    >
                        <span className="clue-num">{i + 1}</span>
                        <span className="clue-text">{clue}</span>
                    </motion.div>
                ))}
            </div>

            {/* Progress bar */}
            <div style={{
                height: 4,
                background: 'var(--border-subtle)',
                borderRadius: 99,
                overflow: 'hidden',
            }}>
                <motion.div
                    style={{
                        height: '100%',
                        background: 'var(--gradient-hero)',
                        borderRadius: 99,
                    }}
                    initial={{ width: '0%' }}
                    animate={{ width: `${(Object.values(assignments).filter(v => v).length / people.length) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                />
            </div>

            {/* Assignment grid */}
            <div className="deduction-assignment">
                <h3 className="clues-title">🎯 Your Answers</h3>
                {people.map((person, i) => (
                    <motion.div
                        key={person}
                        className="assignment-row"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.07 }}
                    >
                        <div className="assignment-person">
                            <span style={{ fontSize: '1rem' }}>
                                {['👤', '👥', '🧑', '👩'][i % 4]}
                            </span>{' '}
                            {person}
                        </div>
                        <div className="assignment-picker">
                            {items.map(item => {
                                const isSelected = assignments[person] === item;
                                // Check if someone else already picked this item
                                const takenByOther = !isSelected && conflictingItems.filter(v => v === item).length > 0;

                                return (
                                    <motion.button
                                        key={item}
                                        className={`assignment-item ${isSelected ? 'item-selected' : ''}`}
                                        style={takenByOther ? { opacity: 0.4 } : {}}
                                        onClick={() => assign(person, item)}
                                        disabled={disabled}
                                        whileHover={!disabled ? { scale: 1.05 } : {}}
                                        whileTap={!disabled ? { scale: 0.95 } : {}}
                                    >
                                        {item}
                                        {isSelected && ' ✓'}
                                    </motion.button>
                                );
                            })}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Solved state */}
            {solved && (
                <motion.p
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                        textAlign: 'center',
                        color: 'var(--accent-green)',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        padding: '10px',
                        background: 'rgba(16,185,129,0.08)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid rgba(16,185,129,0.2)',
                    }}
                >
                    ✅ You've assigned everyone! Submit your answer.
                </motion.p>
            )}
        </div>
    );
};

export default DeductionPuzzleUI;
