/**
 * HeatmapCell — individual day cell (React.memo optimized)
 *
 * Features:
 * - Staggered reveal animation (efficient: capped at 200ms max delay)
 * - Color intensity levels 0–4
 * - Today highlight with pulsing ring
 * - Perfect-score glow
 * - Streak run visual connection (start / mid / end tags)
 * - Completion burst animation triggered externally via `justCompleted` prop
 */
import React, { memo, useCallback, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HeatmapDay, IntensityLevel } from '../../lib/db';
import { INTENSITY_COLORS } from './constants';

interface HeatmapCellProps {
    day: HeatmapDay;
    colIndex: number;
    rowIndex: number;
    onHover: (day: HeatmapDay | null, x: number, y: number) => void;
    onClick: (day: HeatmapDay) => void;
    justCompleted?: boolean; // trigger burst animation
}

// Burst particles for completion animation
const BURST_COLORS = ['#F59E0B', '#10B981', '#7C3AED', '#EC4899', '#06B6D4'];

const HeatmapCell: React.FC<HeatmapCellProps> = memo(({
    day, colIndex, rowIndex, onHover, onClick, justCompleted = false,
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const [showBurst, setShowBurst] = useState(false);

    // Trigger burst when justCompleted changes to true
    useEffect(() => {
        if (justCompleted) {
            setShowBurst(true);
            const t = setTimeout(() => setShowBurst(false), 1200);
            return () => clearTimeout(t);
        }
    }, [justCompleted]);

    const handleMouseEnter = useCallback(() => {
        const rect = ref.current?.getBoundingClientRect();
        if (rect) onHover(day, rect.left + rect.width / 2, rect.top);
    }, [day, onHover]);

    const handleMouseLeave = useCallback(() => {
        onHover(null, 0, 0);
    }, [onHover]);

    const handleClick = useCallback(() => {
        if (!day.isFuture) onClick(day);
    }, [day, onClick]);

    const bg = INTENSITY_COLORS[day.intensity as IntensityLevel];

    // Streak visual classes
    const streakClass = day.isStreakStart
        ? 'hm-cell-streak-start'
        : day.isStreakEnd
            ? 'hm-cell-streak-end'
            : day.isStreakMid
                ? 'hm-cell-streak-mid'
                : '';

    // Efficient animation: cap max delay at 200ms (no stagger for distant past cells)
    const maxStaggerIndex = 200;
    const staggerIndex = Math.min(colIndex * 7 + rowIndex, maxStaggerIndex);
    const animDelay = staggerIndex * 0.001; // max 0.2s

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <motion.div
                className={`hm-cell
                    ${day.isToday ? 'hm-cell-today' : ''}
                    ${day.isFuture ? 'hm-cell-future' : ''}
                    ${day.intensity === 4 ? 'hm-cell-perfect' : ''}
                    ${streakClass}
                `}
                style={{ background: justCompleted ? undefined : bg }}
                title={day.date}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
                // Staggered reveal
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{
                    scale: 1,
                    opacity: day.isFuture ? 0.2 : 1,
                    background: justCompleted
                        ? ['#F59E0B', '#10B981', '#7C3AED', bg]
                        : bg,
                }}
                transition={{
                    delay: animDelay,
                    duration: justCompleted ? 0.8 : 0.25,
                    ease: 'easeOut',
                    background: { duration: 0.8 },
                }}
                whileHover={!day.isFuture ? { scale: 1.6, zIndex: 20, transition: { duration: 0.1 } } : {}}
            />

            {/* Completion burst particles */}
            <AnimatePresence>
                {showBurst && BURST_COLORS.map((color, i) => (
                    <motion.div
                        key={i}
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: color,
                            zIndex: 30,
                            pointerEvents: 'none',
                        }}
                        initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                        animate={{
                            x: Math.cos((i / BURST_COLORS.length) * Math.PI * 2) * 20,
                            y: Math.sin((i / BURST_COLORS.length) * Math.PI * 2) * 20,
                            scale: 0,
                            opacity: 0,
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
});

HeatmapCell.displayName = 'HeatmapCell';
export default HeatmapCell;
