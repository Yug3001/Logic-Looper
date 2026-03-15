import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BinaryPuzzle } from '../../../lib/puzzleEngine';

interface Props {
    puzzle: BinaryPuzzle;
    onChange: (grid: (0 | 1 | null)[][]) => void;
    disabled?: boolean;
}

const BinaryPuzzleUI: React.FC<Props> = ({ puzzle, onChange, disabled }) => {
    const [grid, setGrid] = useState<(0 | 1 | null)[][]>(
        puzzle.rows.map(r => [...r])
    );

    useEffect(() => { onChange(grid); }, [grid]);

    const toggle = (r: number, c: number) => {
        if (disabled || puzzle.rows[r][c] !== null) return;
        const g = grid.map(row => [...row]) as (0 | 1 | null)[][];
        const cur = g[r][c];
        g[r][c] = cur === null ? 0 : cur === 0 ? 1 : null;
        setGrid(g);
    };

    const isConflict = (r: number, c: number): boolean => {
        const val = grid[r][c];
        if (val === null) return false;
        // 3 in a row check
        if (c >= 2 && grid[r][c - 1] === val && grid[r][c - 2] === val) return true;
        if (r >= 2 && grid[r - 1]?.[c] === val && grid[r - 2]?.[c] === val) return true;
        if (c <= puzzle.size - 3 && grid[r][c + 1] === val && grid[r][c + 2] === val) return true;
        if (r <= puzzle.size - 3 && grid[r + 1]?.[c] === val && grid[r + 2]?.[c] === val) return true;
        return false;
    };

    return (
        <div className="puzzle-binary">
            <p className="puzzle-instructions">
                Fill the grid with 0s and 1s. No 3 identical in a row. Equal count per row/column.
            </p>

            <div
                className="binary-grid"
                style={{ gridTemplateColumns: `repeat(${puzzle.size}, 1fr)` }}
            >
                {grid.map((row, r) =>
                    row.map((cell, c) => {
                        const fixed = puzzle.rows[r][c] !== null;
                        const conflict = isConflict(r, c);

                        return (
                            <motion.button
                                key={`${r}-${c}`}
                                className={`binary-cell
                  ${fixed ? 'binary-fixed' : 'binary-editable'}
                  ${cell === 1 ? 'binary-one' : cell === 0 ? 'binary-zero' : 'binary-empty'}
                  ${conflict ? 'binary-conflict' : ''}
                `}
                                onClick={() => toggle(r, c)}
                                whileHover={!fixed && !disabled ? { scale: 1.08 } : {}}
                                whileTap={!fixed && !disabled ? { scale: 0.92 } : {}}
                            >
                                {cell !== null ? cell : ''}
                            </motion.button>
                        );
                    })
                )}
            </div>

            <p className="binary-helper">Tap empty cells to cycle: blank → 0 → 1 → blank</p>
        </div>
    );
};

export default BinaryPuzzleUI;
