import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { PatternPuzzle } from '../../../lib/puzzleEngine';

interface Props {
    puzzle: PatternPuzzle;
    onChange: (answer: string) => void;
    disabled?: boolean;
}

const PatternPuzzleUI: React.FC<Props> = ({ puzzle, onChange, disabled }) => {
    const [selected, setSelected] = useState<string | null>(null);

    const handleSelect = (opt: string) => {
        if (disabled || selected === opt) return;
        setSelected(opt);
        onChange(opt);
    };

    return (
        <div className="puzzle-pattern">
            <p className="puzzle-instructions">
                Identify the repeating pattern and choose what comes next.
            </p>

            {/* Pattern sequence */}
            <div className="pattern-row">
                {puzzle.items.map((item, i) => (
                    <motion.div
                        key={i}
                        className="pattern-item"
                        initial={{ opacity: 0, scale: 0.3 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.06, type: 'spring', stiffness: 300 }}
                    >
                        {item}
                    </motion.div>
                ))}
                <motion.div
                    className="pattern-blank"
                    animate={{ borderColor: ['#7C3AED', '#EC4899', '#7C3AED'] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                >
                    {selected !== null ? selected : '?'}
                </motion.div>
            </div>

            {/* Options */}
            <div className="pattern-options">
                {puzzle.options.map((opt, i) => (
                    <motion.button
                        key={i}
                        className={`pattern-option-btn ${selected === opt ? 'option-selected' : ''}`}
                        onClick={() => handleSelect(opt)}
                        disabled={disabled || selected === opt}
                        whileHover={!disabled && selected !== opt ? { scale: 1.12, rotate: 5 } : {}}
                        whileTap={!disabled && selected !== opt ? { scale: 0.9 } : {}}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + i * 0.1 }}
                    >
                        {opt}
                    </motion.button>
                ))}
            </div>
        </div>
    );
};

export default PatternPuzzleUI;
