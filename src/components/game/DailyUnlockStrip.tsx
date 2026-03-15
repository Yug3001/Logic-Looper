/**
 * DailyUnlockStrip — Module 2: Daily Unlock & Streak Logic
 *
 * Shows the last 7 days + today as a visual strip.
 * - Today: unlocked (playable)
 * - Past solved: green/gold ring
 * - Past not solved: locked icon
 * - Future: clearly hidden (not shown)
 *
 * Also displays streak count prominently.
 * Timezone: uses local date (formatDateLocal), so midnight resets correctly per device.
 */
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { DailyActivity, formatDateLocal, calculateStreakFromActivity } from '../../lib/db';
import { getDailyPuzzleConfig } from '../../lib/puzzleEngine';
import './DailyUnlockStrip.css';

interface Props {
    activityMap: Map<string, DailyActivity>;
    today: string;
}

interface DaySlot {
    date: string;
    label: string;       // "Mon", "Tue", etc.
    dayNum: number;      // Day of month
    isToday: boolean;
    activity?: DailyActivity;
    puzzleType: string;
    puzzleIcon: string;
}

const PUZZLE_ICONS: Record<string, string> = {
    matrix: '🔢', sequence: '📐', pattern: '🎨', binary: '💻', deduction: '🔍',
};
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DailyUnlockStrip: React.FC<Props> = ({ activityMap, today }) => {
    const days = useMemo((): DaySlot[] => {
        const result: DaySlot[] = [];
        for (let offset = 6; offset >= 0; offset--) {
            const d = new Date();
            d.setDate(d.getDate() - offset);
            const dateStr = formatDateLocal(d);
            const config = getDailyPuzzleConfig(dateStr);
            const pType = config.type;
            result.push({
                date: dateStr,
                label: DAY_NAMES[d.getDay()],
                dayNum: d.getDate(),
                isToday: dateStr === today,
                activity: activityMap.get(dateStr),
                puzzleType: pType,
                puzzleIcon: PUZZLE_ICONS[pType] ?? '🧩',
            });
        }
        return result;
    }, [activityMap, today]);

    const { current: currentStreak, longest: longestStreak } = useMemo(
        () => calculateStreakFromActivity(activityMap),
        [activityMap],
    );

    return (
        <motion.div
            className="daily-unlock-strip"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            {/* Streak indicator */}
            <div className="dus-streak-box">
                <motion.div
                    className="dus-streak-flame"
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                >
                    🔥
                </motion.div>
                <div className="dus-streak-info">
                    <span className="dus-streak-count">{currentStreak}</span>
                    <span className="dus-streak-label">day streak</span>
                </div>
                {longestStreak > 0 && (
                    <div className="dus-streak-best">Best: {longestStreak}</div>
                )}
            </div>

            {/* 7-day unlock calendar */}
            <div className="dus-days">
                {days.map((slot, i) => {
                    const solved = slot.activity?.solved ?? false;
                    const missed = !slot.isToday && !solved;

                    return (
                        <motion.div
                            key={slot.date}
                            className={`dus-day
                                ${slot.isToday ? 'dus-today' : ''}
                                ${solved ? 'dus-solved' : ''}
                                ${missed ? 'dus-missed' : ''}
                            `}
                            initial={{ opacity: 0, scale: 0.7 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.06, type: 'spring', stiffness: 300, damping: 20 }}
                            title={
                                slot.isToday
                                    ? `Today (${slot.date}) — ${solved ? 'Solved!' : 'Click to play'}`
                                    : solved
                                        ? `${slot.date} — Solved! Score: ${slot.activity?.score?.toLocaleString()} pts`
                                        : `${slot.date} — Missed`
                            }
                        >
                            {/* Puzzle type icon */}
                            <div className="dus-icon">
                                {missed ? '🔒' : slot.isToday && !solved ? slot.puzzleIcon : solved ? '✅' : slot.puzzleIcon}
                            </div>

                            {/* Day label */}
                            <div className="dus-label">{slot.label}</div>
                            <div className="dus-daynum">{slot.dayNum}</div>

                            {/* Score micro-badge on solved days */}
                            {solved && slot.activity?.score !== undefined && (
                                <div className="dus-score">{slot.activity.score}</div>
                            )}

                            {/* Today glow ring */}
                            {slot.isToday && (
                                <motion.div
                                    className="dus-today-ring"
                                    animate={{ opacity: [0.6, 1, 0.6] }}
                                    transition={{ repeat: Infinity, duration: 2 }}
                                />
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* Timezone note */}
            <div className="dus-tz-note">
                Resets at local midnight · {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </div>
        </motion.div>
    );
};

export default DailyUnlockStrip;
