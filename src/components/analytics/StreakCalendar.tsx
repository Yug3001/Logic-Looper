import React, { useState } from 'react';
import dayjs from 'dayjs';
import { DailyScore } from '../../store/analyticsSlice';
import './StreakCalendar.css';

interface Props {
    scores: DailyScore[];
    currentStreak: number;
}

const StreakCalendar: React.FC<Props> = ({ scores, currentStreak }) => {
    const [selectedMonth, setSelectedMonth] = useState(dayjs().month());
    const [selectedYear] = useState(dayjs().year());

    const scoreMap = new Map<string, DailyScore>();
    scores.forEach(s => { if (s.completed) scoreMap.set(s.date, s); });

    const firstDay = dayjs(`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`);
    const daysInMonth = firstDay.daysInMonth();
    const startDow = firstDay.day(); // 0=Sun

    const cells: (dayjs.Dayjs | null)[] = [
        ...Array(startDow).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => firstDay.add(i, 'day')),
    ];
    // pad to full weeks
    while (cells.length % 7 !== 0) cells.push(null);

    const today = dayjs();

    return (
        <div className="streak-calendar">
            {/* Month Nav */}
            <div className="cal-nav">
                <button
                    className="cal-nav-btn"
                    onClick={() => setSelectedMonth(m => m === 0 ? 11 : m - 1)}
                    disabled={selectedMonth === 0}
                >‹</button>
                <span className="cal-month-label">
                    {dayjs(`${selectedYear}-${selectedMonth + 1}-01`).format('MMMM YYYY')}
                </span>
                <button
                    className="cal-nav-btn"
                    onClick={() => setSelectedMonth(m => m === today.month() ? m : m + 1)}
                    disabled={selectedMonth === today.month()}
                >›</button>
            </div>

            {/* Day Headers */}
            <div className="cal-dow-header">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <div key={i} className="cal-dow">{d}</div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="cal-grid">
                {cells.map((day, i) => {
                    if (!day) return <div key={i} className="cal-cell empty" />;
                    const dateStr = day.format('YYYY-MM-DD');
                    const score = scoreMap.get(dateStr);
                    const isToday = day.isSame(today, 'day');
                    const isFuture = day.isAfter(today);
                    const hasScore = !!score;

                    return (
                        <div
                            key={i}
                            className={`cal-cell ${hasScore ? 'completed' : ''} ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''}`}
                            data-tooltip={hasScore ? `${day.format('MMM D')}: ${score!.score} pts` : day.format('MMM D')}
                        >
                            <span className="cal-day-num">{day.date()}</span>
                            {hasScore && <div className="cal-dot" />}
                        </div>
                    );
                })}
            </div>

            {/* Streak Info Footer */}
            <div className="streak-footer">
                <div className="streak-stat">
                    <span className="streak-stat-icon">🔥</span>
                    <span className="streak-stat-val">{currentStreak}</span>
                    <span className="streak-stat-label">current</span>
                </div>
                <div className="streak-divider"></div>
                <div className="streak-stat">
                    <span className="streak-stat-icon">✅</span>
                    <span className="streak-stat-val">{scores.filter(s => {
                        const d = dayjs(s.date);
                        return d.month() === selectedMonth && d.year() === selectedYear && s.completed;
                    }).length}</span>
                    <span className="streak-stat-label">this month</span>
                </div>
                <div className="streak-divider"></div>
                <div className="cal-legend">
                    <div className="cal-legend-item">
                        <div className="cal-cell completed mini" />
                        <span>Solved</span>
                    </div>
                    <div className="cal-legend-item">
                        <div className="cal-cell mini" />
                        <span>Missed</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StreakCalendar;
