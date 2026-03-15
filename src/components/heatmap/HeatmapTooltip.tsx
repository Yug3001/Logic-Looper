/**
 * HeatmapTooltip — shows date, score, time, difficulty, puzzle type on hover
 */
import React from 'react';
import { motion } from 'framer-motion';
import { HeatmapDay, INTENSITY_LABELS_MAP, IntensityLevel } from '../../lib/db';
import dayjs from 'dayjs';
import { INTENSITY_COLORS, INTENSITY_LABELS } from './constants';

interface HeatmapTooltipProps {
    day: HeatmapDay;
    x: number;
    y: number;
}

const DIFFICULTY_LABELS = ['Easy', 'Medium', 'Hard', 'Expert'];
const DIFFICULTY_COLORS = ['#10B981', '#F59E0B', '#F97316', '#EF4444'];

const HeatmapTooltip: React.FC<HeatmapTooltipProps> = ({ day, x, y }) => {
    const { activity, date, intensity, isToday, isFuture } = day;
    const formattedDate = dayjs(date).format('dddd, MMMM D, YYYY');

    return (
        <motion.div
            className="hm-tooltip"
            style={{ left: x, top: y - 8 }}
            initial={{ opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
        >
            {/* Date Header */}
            <div className="hmt-header">
                <div
                    className="hmt-intensity-dot"
                    style={{ background: INTENSITY_COLORS[intensity as IntensityLevel] }}
                />
                <span className="hmt-date">{formattedDate}</span>
                {isToday && <span className="hmt-today-badge">Today</span>}
            </div>

            {isFuture ? (
                <div className="hmt-future">🔒 Not yet available</div>

            ) : !activity ? (
                <div className="hmt-no-play">No puzzle played</div>

            ) : (
                <div className="hmt-details">
                    {/* Score */}
                    <div className="hmt-row hmt-score-row">
                        <span className="hmt-icon">⭐</span>
                        <span className="hmt-label">Score</span>
                        <span className="hmt-val hmt-score-val">{activity.score.toLocaleString()}</span>
                    </div>

                    {/* Time */}
                    <div className="hmt-row">
                        <span className="hmt-icon">⏱️</span>
                        <span className="hmt-label">Time</span>
                        <span className="hmt-val">
                            {Math.floor(activity.timeTaken / 60)}m {activity.timeTaken % 60}s
                        </span>
                    </div>

                    {/* Difficulty */}
                    <div className="hmt-row">
                        <span className="hmt-icon">🎯</span>
                        <span className="hmt-label">Difficulty</span>
                        <span
                            className="hmt-val hmt-difficulty"
                            style={{ color: DIFFICULTY_COLORS[activity.difficulty] }}
                        >
                            {DIFFICULTY_LABELS[activity.difficulty]}
                        </span>
                    </div>

                    {/* Puzzle Type */}
                    <div className="hmt-row">
                        <span className="hmt-icon">🧩</span>
                        <span className="hmt-label">Type</span>
                        <span className="hmt-val hmt-type">
                            {activity.puzzleType.charAt(0).toUpperCase() + activity.puzzleType.slice(1)}
                        </span>
                    </div>

                    {/* Hints */}
                    {activity.hintsUsed > 0 && (
                        <div className="hmt-row">
                            <span className="hmt-icon">💡</span>
                            <span className="hmt-label">Hints used</span>
                            <span className="hmt-val">{activity.hintsUsed}</span>
                        </div>
                    )}

                    {/* Intensity badge */}
                    <div
                        className="hmt-intensity-badge"
                        style={{
                            background: INTENSITY_COLORS[intensity as IntensityLevel] + '22',
                            color: INTENSITY_COLORS[intensity as IntensityLevel],
                            borderColor: INTENSITY_COLORS[intensity as IntensityLevel] + '55',
                        }}
                    >
                        {INTENSITY_LABELS[intensity as IntensityLevel]}
                    </div>
                </div>
            )}

            {/* Arrow */}
            <div className="hmt-arrow" />
        </motion.div>
    );
};

export default HeatmapTooltip;
