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
        const newAssign = { ...assignments, [person]: item };
        setAssignments(newAssign);
        onChange(newAssign);
    };

    return (
        <div className="puzzle-deduction">
            <p className="puzzle-instructions">
                Use the clues to match each person to the correct item.
            </p>

            {/* Clues */}
            <div className="deduction-clues">
                <h3 className="clues-title">🔍 Clues</h3>
                {puzzle.clues.map((clue, i) => (
                    <motion.div
                        key={i}
                        className="clue-item"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                    >
                        <span className="clue-num">{i + 1}</span>
                        <span className="clue-text">{clue}</span>
                    </motion.div>
                ))}
            </div>

            {/* Assignment Grid */}
            <div className="deduction-assignment">
                <h3 className="clues-title">Your Answers</h3>
                {people.map((person, i) => (
                    <motion.div
                        key={person}
                        className="assignment-row"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 + i * 0.1 }}
                    >
                        <div className="assignment-person">{person}</div>
                        <div className="assignment-picker">
                            {items.map(item => (
                                <button
                                    key={item}
                                    className={`assignment-item ${assignments[person] === item ? 'item-selected' : ''}`}
                                    onClick={() => assign(person, item)}
                                    disabled={disabled}
                                >
                                    {item}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default DeductionPuzzleUI;
