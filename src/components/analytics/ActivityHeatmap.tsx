import React, { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import { motion } from 'framer-motion';
import { DailyScore } from '../../store/analyticsSlice';
import './ActivityHeatmap.css';

interface ActivityHeatmapProps {
    scores: DailyScore[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

function getIntensity(score: number): 0 | 1 | 2 | 3 | 4 {
    if (score === 0) return 0;
    if (score < 700) return 1;
    if (score < 800) return 2;
    if (score < 900) return 3;
    return 4;
}

const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ scores }) => {
    const [tooltip, setTooltip] = useState<{ date: string; score: number; x: number; y: number } | null>(null);

    const scoreMap = useMemo(() => {
        const map = new Map<string, number>();
        scores.forEach(s => { if (s.completed) map.set(s.date, s.score); });
        return map;
    }, [scores]);

    // Build 52-week grid (364 days + partial)
    const today = dayjs();
    const startDate = today.subtract(51, 'week').startOf('week');

    const weeks: { date: dayjs.Dayjs; score: number; intensity: 0 | 1 | 2 | 3 | 4 }[][] = [];
    let currentWeek: { date: dayjs.Dayjs; score: number; intensity: 0 | 1 | 2 | 3 | 4 }[] = [];
    let current = startDate;

    while (current.isBefore(today.add(1, 'day'))) {
        const score = scoreMap.get(current.format('YYYY-MM-DD')) ?? 0;
        const isFuture = current.isAfter(today);
        currentWeek.push({
            date: current,
            score,
            intensity: isFuture ? 0 : getIntensity(score),
        });
        if (currentWeek.length === 7) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
        current = current.add(1, 'day');
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    // Month labels
    const monthLabels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, i) => {
        const firstDay = week[0];
        if (firstDay && firstDay.date.month() !== lastMonth) {
            monthLabels.push({ label: MONTHS[firstDay.date.month()], col: i });
            lastMonth = firstDay.date.month();
        }
    });

    const handleCellHover = (e: React.MouseEvent, date: dayjs.Dayjs, score: number) => {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setTooltip({
            date: date.format('MMMM D, YYYY'),
            score,
            x: rect.left,
            y: rect.top,
        });
    };

    return (
        <div className="heatmap-wrapper">
            {/* Month Labels */}
            <div className="heatmap-months" style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}>
                {weeks.map((_, i) => {
                    const ml = monthLabels.find(m => m.col === i);
                    return <div key={i} className="month-label">{ml?.label ?? ''}</div>;
                })}
            </div>

            <div className="heatmap-body">
                {/* Day Labels */}
                <div className="day-labels">
                    {DAYS.map((d, i) => <div key={i} className="day-label">{d}</div>)}
                </div>

                {/* Grid */}
                <div className="heatmap-grid" style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}>
                    {weeks.map((week, wi) =>
                        week.map((cell, di) => (
                            <motion.div
                                key={`${wi}-${di}`}
                                className={`heatmap-cell intensity-${cell.intensity}`}
                                title={`${cell.date.format('MMM D')}: ${cell.score > 0 ? cell.score + ' pts' : 'No puzzle'}`}
                                onMouseEnter={(e) => handleCellHover(e, cell.date, cell.score)}
                                onMouseLeave={() => setTooltip(null)}
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: (wi * 7 + di) * 0.001, duration: 0.15 }}
                                whileHover={{ scale: 1.4, zIndex: 10 }}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Tooltip */}
            {tooltip && (
                <div
                    className="heatmap-tooltip"
                    style={{ top: tooltip.y - 60, left: tooltip.x }}
                >
                    <div className="tooltip-date">{tooltip.date}</div>
                    {tooltip.score > 0
                        ? <div className="tooltip-score">🏆 {tooltip.score.toLocaleString()} pts</div>
                        : <div className="tooltip-score empty">No puzzle played</div>
                    }
                </div>
            )}

            {/* Legend */}
            <div className="heatmap-legend">
                <span className="legend-label">Less</span>
                {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className={`heatmap-cell intensity-${i} legend-cell`} />
                ))}
                <span className="legend-label">More</span>
            </div>
        </div>
    );
};

export default ActivityHeatmap;
