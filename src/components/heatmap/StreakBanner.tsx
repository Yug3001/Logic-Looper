/**
 * StreakBanner — animated streak display with fire icon and stats
 */
import React from 'react';
import { motion } from 'framer-motion';
import { MilestoneBadge } from '../../hooks/useHeatmap';
import './StreakBanner.css';

interface StreakBannerProps {
    currentStreak: number;
    longestStreak: number;
    totalSolved: number;
    milestone: MilestoneBadge | null;
}

const StreakBanner: React.FC<StreakBannerProps> = ({
    currentStreak, longestStreak, totalSolved, milestone,
}) => {
    return (
        <div className="streak-banner">
            {/* Fire + Streak Count */}
            <div className="sb-main">
                <motion.div
                    className="sb-fire"
                    animate={{ scaleY: [1, 1.08, 0.97, 1], skewX: [0, -2, 2, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                >
                    🔥
                </motion.div>
                <div className="sb-count-wrap">
                    <motion.span
                        key={currentStreak}
                        className="sb-count"
                        initial={{ scale: 1.4, opacity: 0, y: -10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                    >
                        {currentStreak}
                    </motion.span>
                    <span className="sb-count-label">day streak</span>
                </div>

                {/* Milestone badge */}
                {milestone && (
                    <motion.div
                        className="sb-milestone"
                        style={{ background: milestone.color + '22', color: milestone.color, borderColor: milestone.color + '55' }}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', delay: 0.2 }}
                    >
                        <span>{milestone.emoji}</span>
                        <span>{milestone.label}</span>
                    </motion.div>
                )}
            </div>

            {/* Stats Row */}
            <div className="sb-stats">
                <div className="sb-stat">
                    <span className="sb-stat-val">{totalSolved}</span>
                    <span className="sb-stat-label">Total Solved</span>
                </div>
                <div className="sb-stat-divider" />
                <div className="sb-stat">
                    <span className="sb-stat-val">{longestStreak}</span>
                    <span className="sb-stat-label">Best Streak</span>
                </div>
                <div className="sb-stat-divider" />
                <div className="sb-stat">
                    <span className="sb-stat-val">
                        {totalSolved > 0 ? Math.round((totalSolved / 365) * 100) : 0}%
                    </span>
                    <span className="sb-stat-label">Completion</span>
                </div>
            </div>

            {/* Animated progress bar for streak goal */}
            <div className="sb-progress-wrap">
                <div className="sb-progress-label">
                    <span>Next milestone</span>
                    <span>
                        {getNextMilestone(currentStreak) - currentStreak} days to go
                    </span>
                </div>
                <div className="sb-progress-track">
                    <motion.div
                        className="sb-progress-fill"
                        initial={{ width: 0 }}
                        animate={{ width: `${getStreakProgress(currentStreak)}%` }}
                        transition={{ duration: 1.2, ease: 'easeOut' }}
                    />
                </div>
            </div>
        </div>
    );
};

const MILESTONES = [7, 14, 30, 50, 100, 200, 365];

function getNextMilestone(streak: number): number {
    return MILESTONES.find(m => m > streak) ?? 365;
}

function getStreakProgress(streak: number): number {
    const prev = [...MILESTONES].reverse().find(m => m <= streak) ?? 0;
    const next = getNextMilestone(streak);
    if (prev === next) return 100;
    return Math.round(((streak - prev) / (next - prev)) * 100);
}

export default StreakBanner;
