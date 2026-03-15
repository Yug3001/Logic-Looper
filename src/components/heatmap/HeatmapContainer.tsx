/**
 * HeatmapContainer — Module 3: Daily Heatmap System
 *
 * Deliverables:
 *  ✅ GitHub-style 7-row grid (columns = weeks)
 *  ✅ 365/366-day generation (leap year correct)
 *  ✅ Intensity levels 0–4 based on difficulty/score
 *  ✅ Rich tooltip on hover (score, time, type, difficulty)
 *  ✅ Current day highlighted with pulsing ring
 *  ✅ Responsive layout (overflow-x scroll on mobile)
 *  ✅ Smooth staggered animation on load (performance-capped)
 *  ✅ Completion animation (burst particles) when solve recorded
 *  ✅ Streak run visualization (connected cells)
 *  ✅ Month summary stats panel
 *  ✅ Color theme switcher (4 themes)
 *  ✅ Year selector (previous + current year)
 *  ✅ Server sync button
 *  ✅ Offline rendering (IndexedDB primary source)
 */
import React, { useState, useRef, useCallback, memo, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HeatmapDay, IntensityLevel, buildMonthSummaries, formatDateLocal } from '../../lib/db';
import { useHeatmap } from '../../hooks/useHeatmap';
import HeatmapCell from './HeatmapCell';
import HeatmapTooltip from './HeatmapTooltip';
import StreakBanner from './StreakBanner';
import MilestoneCelebration from './MilestoneCelebration';
import AchievementToast from './AchievementToast';
import './Heatmap.css';

import { INTENSITY_COLORS, INTENSITY_LABELS } from './constants';

export type HeatmapColorTheme = 'purple' | 'green' | 'cyan' | 'pink';

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── HeatmapGrid ─────────────────────────────────────────────────────────────

interface HeatmapGridProps {
    weeks: HeatmapDay[][];
    onCellHover: (day: HeatmapDay | null, x: number, y: number) => void;
    onCellClick: (day: HeatmapDay) => void;
    todayDate: string;
    lastSolveDate?: string; // date of most recent solve for burst animation
}

const HeatmapGrid: React.FC<HeatmapGridProps> = memo(({
    weeks, onCellHover, onCellClick, todayDate, lastSolveDate,
}) => {
    // Month labels above columns — only first cell of each month gets a label
    const monthLabels = useMemo(() => weeks.map((week) => {
        const first = week.find(d => d !== null && d !== undefined);
        return first?.monthLabel ?? '';
    }), [weeks]);

    return (
        <div className="hm-grid-wrapper">
            {/* Month labels row */}
            <div
                className="hm-months"
                style={{ gridTemplateColumns: `repeat(${weeks.length}, 14px)` }}
            >
                {monthLabels.map((label, i) => (
                    <div key={i} className="hm-month-label">{label}</div>
                ))}
            </div>

            <div className="hm-body">
                {/* Day-of-week column labels */}
                <div className="hm-dow-labels">
                    {DOW_LABELS.map((d, i) => (
                        <div key={i} className="hm-dow">{i % 2 !== 0 ? d : ''}</div>
                    ))}
                </div>

                {/* Week columns */}
                <div
                    className="hm-columns"
                    style={{ gridTemplateColumns: `repeat(${weeks.length}, 14px)` }}
                >
                    {weeks.map((week, wi) => (
                        <div key={wi} className="hm-column">
                            {week.map((day, di) => (
                                day ? (
                                    <HeatmapCell
                                        key={day.date}
                                        day={day}
                                        colIndex={wi}
                                        rowIndex={di}
                                        onHover={onCellHover}
                                        onClick={onCellClick}
                                        justCompleted={day.date === lastSolveDate && day.date === todayDate}
                                    />
                                ) : (
                                    <div key={`empty-${wi}-${di}`} className="hm-cell-empty" />
                                )
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});
HeatmapGrid.displayName = 'HeatmapGrid';

// ─── Month Stats Panel ────────────────────────────────────────────────────────

const MonthStatsPanel: React.FC<{
    activityMap: Map<string, import('../../lib/db').DailyActivity>;
    year: number;
}> = memo(({ activityMap, year }) => {
    const summaries = useMemo(
        () => buildMonthSummaries(activityMap, year),
        [activityMap, year],
    );

    const currentMonth = new Date().getMonth(); // 0-indexed

    return (
        <div className="hm-month-stats">
            <div className="hm-month-stats-title">Monthly Breakdown</div>
            <div className="hm-month-grid">
                {summaries.map((s, i) => {
                    const completionPct = s.totalDays > 0
                        ? Math.round((s.solvedDays / s.totalDays) * 100)
                        : 0;
                    const isCurrent = i === currentMonth && year === new Date().getFullYear();
                    const isPast = i < currentMonth || year < new Date().getFullYear();

                    return (
                        <motion.div
                            key={s.month}
                            className={`hm-month-card ${isCurrent ? 'hm-month-current' : ''}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                        >
                            <div className="hm-mc-name">{s.month}</div>
                            <div className="hm-mc-bar">
                                <motion.div
                                    className="hm-mc-fill"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${completionPct}%` }}
                                    transition={{ duration: 0.8, delay: 0.2 + i * 0.04 }}
                                />
                            </div>
                            <div className="hm-mc-pct">
                                {isPast || isCurrent ? `${completionPct}%` : '—'}
                            </div>
                            {s.perfectDays > 0 && (
                                <div className="hm-mc-perfect" title={`${s.perfectDays} perfect days`}>
                                    ⭐{s.perfectDays}
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
});
MonthStatsPanel.displayName = 'MonthStatsPanel';

// ─── HeatmapContainer ─────────────────────────────────────────────────────────

const HeatmapContainer: React.FC = () => {
    const {
        weeks,
        activityMap,
        currentStreak,
        longestStreak,
        totalSolved,
        unsyncedCount,
        newlyUnlocked,
        isSyncing,
        isLoaded,
        selectedYear,
        setSelectedYear,
        manualSync,
        dismissNewAchievements,
        getMilestoneForStreak,
    } = useHeatmap();

    const [tooltip, setTooltip] = useState<{
        day: HeatmapDay;
        x: number;
        y: number;
    } | null>(null);

    const [colorTheme, setColorTheme] = useState<HeatmapColorTheme>('purple');
    const [showMilestone, setShowMilestone] = useState(false);
    const [showMonthStats, setShowMonthStats] = useState(false);
    const [lastSolveDate, setLastSolveDate] = useState<string | undefined>(undefined);

    const containerRef = useRef<HTMLDivElement>(null);
    const today = formatDateLocal(new Date());

    // Track when a new solve appears (for burst animation)
    const prevTotalSolvedRef = useRef(totalSolved);
    useEffect(() => {
        if (totalSolved > prevTotalSolvedRef.current) {
            setLastSolveDate(today);
            // Show milestone if applicable
            setShowMilestone(true);
            setTimeout(() => setShowMilestone(false), 4500);
        }
        prevTotalSolvedRef.current = totalSolved;
    }, [totalSolved, today]);

    const handleCellHover = useCallback((day: HeatmapDay | null, x: number, y: number) => {
        if (!day) { setTooltip(null); return; }
        setTooltip({ day, x, y });
    }, []);

    const handleCellClick = useCallback((day: HeatmapDay) => {
        if (day.isFuture) return;
        // Could navigate to that day's archived view
        console.log('[Heatmap] Cell clicked:', day.date, day.activity);
    }, []);

    // Milestone detection
    const milestone = getMilestoneForStreak(currentStreak);
    const currentYear = new Date().getFullYear();
    const yearOptions = [currentYear - 1, currentYear];

    // Year completion stats
    const yearStats = useMemo(() => {
        const totalYear = weeks.flat().filter(d => d && !d.isFuture).length;
        const solvedYear = weeks.flat().filter(d => d?.activity?.solved).length;
        const completionPct = totalYear > 0 ? Math.round((solvedYear / totalYear) * 100) : 0;
        return { totalYear, solvedYear, completionPct };
    }, [weeks]);

    if (!isLoaded) {
        return (
            <div className="hm-loading">
                <div className="hm-loading-spinner" />
                <span>Loading 365 days of activity…</span>
            </div>
        );
    }

    return (
        <div className={`heatmap-container theme-${colorTheme}`} ref={containerRef}>
            {/* Streak Banner */}
            <StreakBanner
                currentStreak={currentStreak}
                longestStreak={longestStreak}
                totalSolved={totalSolved}
                milestone={milestone}
            />

            {/* Year stats summary bar */}
            <div className="hm-year-summary">
                <span className="hm-year-summary-label">
                    {selectedYear} · {yearStats.solvedYear} / {yearStats.totalYear} days played
                </span>
                <div className="hm-year-bar">
                    <motion.div
                        className="hm-year-bar-fill"
                        initial={{ width: 0 }}
                        animate={{ width: `${yearStats.completionPct}%` }}
                        transition={{ duration: 1.2, ease: 'easeOut' }}
                    />
                </div>
                <span className="hm-year-summary-pct">{yearStats.completionPct}%</span>
            </div>

            {/* Controls Row */}
            <div className="hm-controls">
                <div className="hm-controls-left">
                    {/* Year Selector */}
                    <div className="hm-year-select">
                        {yearOptions.map(y => (
                            <button
                                key={y}
                                className={`hm-year-btn ${selectedYear === y ? 'active' : ''}`}
                                onClick={() => setSelectedYear(y)}
                            >
                                {y}
                            </button>
                        ))}
                    </div>

                    {/* Color Theme */}
                    <div className="hm-theme-picker">
                        {(['purple', 'green', 'cyan', 'pink'] as HeatmapColorTheme[]).map(t => (
                            <button
                                key={t}
                                className={`hm-theme-dot theme-dot-${t} ${colorTheme === t ? 'active' : ''}`}
                                onClick={() => setColorTheme(t)}
                                title={t.charAt(0).toUpperCase() + t.slice(1)}
                            />
                        ))}
                    </div>

                    {/* Month stats toggle */}
                    <button
                        className={`hm-toggle-btn ${showMonthStats ? 'active' : ''}`}
                        onClick={() => setShowMonthStats(v => !v)}
                        title="Monthly breakdown"
                    >
                        📆 {showMonthStats ? 'Hide' : 'Monthly'}
                    </button>
                </div>

                <div className="hm-controls-right">
                    {/* Unsynced badge */}
                    {unsyncedCount > 0 && (
                        <button
                            className={`hm-sync-btn ${isSyncing ? 'syncing' : ''}`}
                            onClick={manualSync}
                            disabled={isSyncing}
                        >
                            <span className="hm-sync-icon">{isSyncing ? '⟳' : '☁'}</span>
                            {isSyncing ? 'Syncing…' : `Sync ${unsyncedCount} pending`}
                        </button>
                    )}
                </div>
            </div>

            {/* 365-day Heatmap Grid */}
            <div className="hm-scroll-container">
                <HeatmapGrid
                    weeks={weeks}
                    onCellHover={handleCellHover}
                    onCellClick={handleCellClick}
                    todayDate={today}
                    lastSolveDate={lastSolveDate}
                />
            </div>

            {/* Legend + Intensity Labels */}
            <div className="hm-legend-row">
                <span className="hm-legend-label">Less</span>
                {([0, 1, 2, 3, 4] as IntensityLevel[]).map(lvl => (
                    <div
                        key={lvl}
                        className="hm-legend-cell"
                        style={{ background: INTENSITY_COLORS[lvl] }}
                        title={INTENSITY_LABELS[lvl]}
                    />
                ))}
                <span className="hm-legend-label">More</span>
                <div className="hm-legend-items">
                    {([0, 1, 2, 3, 4] as IntensityLevel[]).map(lvl => (
                        <div key={lvl} className="hm-legend-item">
                            <div className="hm-legend-cell-sm" style={{ background: INTENSITY_COLORS[lvl] }} />
                            <span>{INTENSITY_LABELS[lvl]}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Monthly Breakdown Panel */}
            <AnimatePresence>
                {showMonthStats && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <MonthStatsPanel activityMap={activityMap} year={selectedYear} />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tooltip */}
            <AnimatePresence>
                {tooltip && (
                    <HeatmapTooltip
                        day={tooltip.day}
                        x={tooltip.x}
                        y={tooltip.y}
                    />
                )}
            </AnimatePresence>

            {/* Milestone Celebration */}
            <AnimatePresence>
                {milestone && showMilestone && (
                    <MilestoneCelebration
                        badge={milestone}
                        streak={currentStreak}
                        onDismiss={() => setShowMilestone(false)}
                    />
                )}
            </AnimatePresence>

            {/* Achievement Toasts */}
            <AnimatePresence>
                {newlyUnlocked.length > 0 && (
                    <AchievementToast
                        achievementIds={newlyUnlocked}
                        onDismiss={dismissNewAchievements}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default HeatmapContainer;
