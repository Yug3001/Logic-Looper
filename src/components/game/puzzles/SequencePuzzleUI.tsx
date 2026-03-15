import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { SequencePuzzle } from '../../../lib/puzzleEngine';

interface Props {
    puzzle: SequencePuzzle;
    onChange: (answer: number) => void;
    disabled?: boolean;
}

const SequencePuzzleUI: React.FC<Props> = ({ puzzle, onChange, disabled }) => {
    const [selected, setSelected] = useState<number | null>(null);

    const handleSelect = (opt: number) => {
        if (disabled || selected === opt) return;
        setSelected(opt);
        onChange(opt);
    };

    return (
        <div className="puzzle-sequence">
            <p className="puzzle-instructions">
                Find the next number in the pattern. Choose the correct option.
            </p>

            {/* Sequence display */}
            <div className="sequence-row">
                {puzzle.sequence.map((n, i) => (
                    <motion.div
                        key={i}
                        className="sequence-number"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                    >
                        {n}
                    </motion.div>
                ))}
                <motion.div
                    className="sequence-blank"
                    animate={{ borderColor: ['#7C3AED', '#06B6D4', '#7C3AED'] }}
                    transition={{ duration: 2, repeat: Infinity }}
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
                        whileHover={!disabled && selected !== opt ? { scale: 1.05 } : {}}
                        whileTap={!disabled && selected !== opt ? { scale: 0.95 } : {}}
                        disabled={disabled || selected === opt}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.08 }}
                    >
                        {opt}
                    </motion.button>
                ))}
            </div>
        </div>
    );
};

export default SequencePuzzleUI;
