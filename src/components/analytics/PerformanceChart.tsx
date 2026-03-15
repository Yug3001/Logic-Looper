import React, { useState } from 'react';
import {
    AreaChart, Area, LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Legend, ReferenceLine
} from 'recharts';
import { DailyScore, WeeklyEntry } from '../../store/analyticsSlice';
import dayjs from 'dayjs';
import './PerformanceChart.css';

interface Props {
    scores: DailyScore[];
    weekly: WeeklyEntry[];
}

type Range = '7d' | '30d' | '90d' | '365d';

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="custom-tooltip">
            <div className="tooltip-label">{label}</div>
            {payload.map((p: any) => (
                <div key={p.name} className="tooltip-row">
                    <span className="tooltip-dot" style={{ background: p.color }}></span>
                    <span className="tooltip-name">{p.name}:</span>
                    <span className="tooltip-val">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
                </div>
            ))}
        </div>
    );
};

const PerformanceChart: React.FC<Props> = ({ scores, weekly }) => {
    const [range, setRange] = useState<Range>('30d');
    const [chartType, setChartType] = useState<'score' | 'time' | 'consistency'>('score');

    const rangeDays = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };

    const filteredScores = scores
        .filter(s => s.date && dayjs(s.date).isAfter(dayjs().subtract(rangeDays[range], 'day')))
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const chartData = filteredScores.map(s => ({
        date: range === '365d' ? dayjs(s.date).format('MMM') : dayjs(s.date).format('MMM D'),
        Score: s.score,
        Time: Math.round(s.timeTaken / 60 * 10) / 10,
        Hints: s.hintsUsed,
        type: s.puzzleType,
    }));

    // Rolling average
    const withAvg = chartData.map((d, i) => {
        const window = chartData.slice(Math.max(0, i - 6), i + 1);
        const avg = window.length ? Math.round(window.reduce((a, b) => a + (b.Score || 0), 0) / window.length) : 0;
        return { ...d, Avg: avg };
    });

    // Weekly bar data
    const weeklyData = weekly.map(w => ({
        day: w.day,
        Score: w.score,
        Time: Math.round(w.time / 60 * 10) / 10,
    }));

    // Scores by puzzle type
    const typeData = ['matrix', 'pattern', 'sequence', 'deduction', 'binary'].map(t => ({
        type: t.charAt(0).toUpperCase() + t.slice(1),
        Avg: Math.round(
            scores.filter(s => s.puzzleType === t).reduce((a, b) => a + (b.score || 0), 0) /
            Math.max(scores.filter(s => s.puzzleType === t).length, 1)
        ),
        Count: scores.filter(s => s.puzzleType === t).length,
    }));

    const avgScore = Math.round(chartData.reduce((a, b) => a + b.Score, 0) / Math.max(chartData.length, 1));

    return (
        <div className="perf-container">
            {/* Controls */}
            <div className="perf-controls">
                <div className="chart-type-tabs">
                    {(['score', 'time', 'consistency'] as const).map(type => (
                        <button
                            key={type}
                            className={`chart-type-tab ${chartType === type ? 'active' : ''}`}
                            onClick={() => setChartType(type)}
                        >
                            {type === 'score' ? '📊 Score' : type === 'time' ? '⏱️ Time' : '🎯 Consistency'}
                        </button>
                    ))}
                </div>
                <div className="range-tabs">
                    {(['7d', '30d', '90d', '365d'] as Range[]).map(r => (
                        <button
                            key={r}
                            className={`range-tab ${range === r ? 'active' : ''}`}
                            onClick={() => setRange(r)}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Chart */}
            <div className="chart-card">
                <div className="chart-header">
                    <div>
                        <h3 className="chart-title">
                            {chartType === 'score' ? 'Score Progression' :
                                chartType === 'time' ? 'Solve Time Trend' : 'Performance Consistency'}
                        </h3>
                        <p className="chart-subtitle">
                            {chartType === 'score' ? `Avg: ${avgScore.toLocaleString()} pts over ${range}` :
                                chartType === 'time' ? 'Minutes per puzzle' : 'Rolling 7-day average'}
                        </p>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                    {chartType === 'score' ? (
                        <AreaChart data={withAvg} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <defs>
                                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="avgGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="date" tick={{ fill: '#5E5A80', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#5E5A80', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <ReferenceLine y={avgScore} stroke="rgba(124,58,237,0.4)" strokeDasharray="6 3" label={{ value: `Avg ${avgScore}`, fill: '#7C3AED', fontSize: 11 }} />
                            <Area type="monotone" dataKey="Score" stroke="#7C3AED" strokeWidth={2} fill="url(#scoreGrad)" dot={false} activeDot={{ r: 5, fill: '#7C3AED' }} />
                            <Area type="monotone" dataKey="Avg" stroke="#06B6D4" strokeWidth={1.5} fill="url(#avgGrad)" dot={false} strokeDasharray="4 2" />
                            <Legend wrapperStyle={{ color: '#A09DC0', fontSize: 12 }} />
                        </AreaChart>
                    ) : chartType === 'time' ? (
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="date" tick={{ fill: '#5E5A80', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#5E5A80', fontSize: 11 }} axisLine={false} tickLine={false} unit="m" />
                            <Tooltip content={<CustomTooltip />} />
                            <Line type="monotone" dataKey="Time" stroke="#EC4899" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                            <Legend wrapperStyle={{ color: '#A09DC0', fontSize: 12 }} />
                        </LineChart>
                    ) : (
                        <AreaChart data={withAvg} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <defs>
                                <linearGradient id="consistencyGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="date" tick={{ fill: '#5E5A80', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#5E5A80', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="Avg" stroke="#10B981" strokeWidth={2.5} fill="url(#consistencyGrad)" dot={false} />
                            <Legend wrapperStyle={{ color: '#A09DC0', fontSize: 12 }} />
                        </AreaChart>
                    )}
                </ResponsiveContainer>
            </div>

            {/* Two-column charts */}
            <div className="perf-two-col">
                {/* Weekly Score Bar */}
                <div className="chart-card">
                    <div className="chart-header">
                        <div>
                            <h3 className="chart-title">This Week</h3>
                            <p className="chart-subtitle">Daily score breakdown</p>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={weeklyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="day" tick={{ fill: '#5E5A80', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#5E5A80', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="Score" fill="#7C3AED" radius={[6, 6, 0, 0]} maxBarSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Puzzle Type Avg */}
                <div className="chart-card">
                    <div className="chart-header">
                        <div>
                            <h3 className="chart-title">By Puzzle Type</h3>
                            <p className="chart-subtitle">Average score per category</p>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={typeData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis type="number" tick={{ fill: '#5E5A80', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="type" tick={{ fill: '#A09DC0', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="Avg" radius={[0, 6, 6, 0]} maxBarSize={20}>
                                {typeData.map((_, i) => {
                                    const colors = ['#7C3AED', '#EC4899', '#10B981', '#F59E0B', '#06B6D4'];
                                    return <rect key={i} fill={colors[i]} />;
                                })}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default PerformanceChart;
