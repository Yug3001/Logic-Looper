import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MatrixPuzzle } from '../../../lib/puzzleEngine';

interface Props {
    puzzle: MatrixPuzzle;
    onChange: (grid: (number | null)[][]) => void;
    disabled?: boolean;
}

const MatrixPuzzleUI: React.FC<Props> = ({ puzzle, onChange, disabled }) => {
    const [grid, setGrid] = useState<(number | null)[][]>(
        puzzle.grid.map(r => [...r])
    );
    const [selected, setSelected] = useState<[number, number] | null>(null);

    useEffect(() => { onChange(grid); }, [grid]);

    const isOriginal = (r: number, c: number) => puzzle.grid[r][c] !== null;

    const setValue = (r: number, c: number, val: number | null) => {
        if (disabled || isOriginal(r, c)) return;
        const g = grid.map(row => [...row]);
        g[r][c] = val;
        setGrid(g);
    };

    const isConflict = (r: number, c: number, val: number | null): boolean => {
        if (!val) return false;
        for (let i = 0; i < puzzle.size; i++) {
            if (i !== c && grid[r][i] === val) return true;
            if (i !== r && grid[i][c] === val) return true;
        }
        return false;
    };

    const numbers = Array.from({ length: puzzle.size }, (_, i) => i + 1);

    return (
        <div className="puzzle-matrix">
            <p className="puzzle-instructions">
                Fill every row and column with numbers 1–{puzzle.size}. Each number appears exactly once per row and column.
            </p>
            <div
                className="matrix-grid"
                style={{ gridTemplateColumns: `repeat(${puzzle.size}, 1fr)` }}
            >
                {grid.map((row, r) =>
                    row.map((cell, c) => {
                        const orig = isOriginal(r, c);
                        const conflict = isConflict(r, c, cell);
                        const isSel = selected?.[0] === r && selected?.[1] === c;

                        return (
                            <motion.div
                                key={`${r}-${c}`}
                                className={`matrix-cell
                  ${orig ? 'cell-original' : 'cell-editable'}
                  ${isSel ? 'cell-selected' : ''}
                  ${conflict ? 'cell-conflict' : ''}
                  ${cell && !conflict ? 'cell-filled' : ''}
                `}
                                onClick={() => !disabled && !orig && setSelected([r, c])}
                                whileHover={!orig && !disabled ? { scale: 1.05 } : {}}
                                whileTap={!orig && !disabled ? { scale: 0.95 } : {}}
                            >
                                {cell ?? ''}
                            </motion.div>
                        );
                    })
                )}
            </div>

            {/* Number Pad */}
            {!disabled && selected && !isOriginal(selected[0], selected[1]) && (
                <div className="matrix-numpad">
                    {numbers.map(n => (
                        <motion.button
                            key={n}
                            className="numpad-btn"
                            onClick={() => setValue(selected[0], selected[1], n)}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                        >
                            {n}
                        </motion.button>
                    ))}
                    <motion.button
                        className="numpad-btn numpad-clear"
                        onClick={() => setValue(selected[0], selected[1], null)}
                        whileHover={{ scale: 1.1 }}
                    >
                        ✕
                    </motion.button>
                </div>
            )}
        </div>
    );
};

export default MatrixPuzzleUI;
