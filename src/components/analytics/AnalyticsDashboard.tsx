import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { motion } from 'framer-motion';
import StatCard from './StatCard';
import ActivityHeatmap from './ActivityHeatmap'; // kept for fallback
import HeatmapContainer from '../heatmap/HeatmapContainer';
import PerformanceChart from './PerformanceChart';
import PuzzleTypeBreakdown from './PuzzleTypeBreakdown';

import StreakCalendar from './StreakCalendar';
import InsightsPanel from './InsightsPanel';
import './AnalyticsDashboard.css';

type ViewMode = 'overview' | 'performance' | 'leaderboard' | 'achievements';

const AnalyticsDashboard: React.FC = () => {
    const analytics = useSelector((s: RootState) => s.analytics);
    const auth = useSelector((s: RootState) => s.auth);
    const [viewMode, setViewMode] = useState<ViewMode>('overview');

    const tabs: { id: ViewMode; label: string; icon: string }[] = [
        { id: 'overview', label: 'Overview', icon: '📈' },
        { id: 'performance', label: 'Performance', icon: '⚡' },
    ];

    const dailyScores = analytics.dailyScores || [];
    const achievements = analytics.achievements || [];
    const puzzleTypeStats = analytics.puzzleTypeStats || [];
    const weeklyProgress = analytics.weeklyProgress || [];

    const unlockedAchievements = achievements.filter(a => a.unlockedAt).length;
    const totalAchievements = Math.max(achievements.length, 1); // guard against /0
    const winRate = Math.round((analytics.totalPuzzlesSolved / 365) * 100) || 0;
    const avgScore = dailyScores.length > 0
        ? Math.round(dailyScores.reduce((s, d) => s + d.score, 0) / dailyScores.length)
        : 0;
    // Guard: Math.max/min on empty arrays returns ±Infinity — use fallback 0
    const bestScore = dailyScores.length > 0
        ? Math.max(...dailyScores.map(s => s.score))
        : 0;
    const bestTime = dailyScores.length > 0
        ? Math.min(...dailyScores.map(s => s.timeTaken))
        : 0;

    return (
        <div className="analytics-dashboard">
            {/* Header */}
            <motion.div
                className="analytics-header"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <div className="header-text">
                    <h1 className="header-title">
                        <span className="gradient-text">Analytics</span>
                    </h1>
                    <p className="header-subtitle">
                        Track your puzzle-solving journey across 365 days
                    </p>
                </div>
                <div className="header-actions">
                    <div className="sync-badge">
                        <span className="sync-dot"></span>
                        <span>Synced 2h ago</span>
                    </div>
                </div>
            </motion.div>

            {/* Tab Navigation */}
            <motion.div
                className="analytics-tabs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`analytics-tab ${viewMode === tab.id ? 'active' : ''}`}
                        onClick={() => setViewMode(tab.id)}
                    >
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                    </button>
                ))}
            </motion.div>

            {/* Overview Tab */}
            {viewMode === 'overview' && (
                <motion.div
                    key="overview"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    className="tab-content"
                >
                    {/* KPI Stats Row */}
                    <div className="stats-grid">
                        <StatCard
                            title="Current Streak"
                            value={`${analytics.currentStreak}`}
                            unit="days"
                            icon="🔥"
                            color="orange"
                            trend={+5}
                            subtitle={`Best: ${analytics.longestStreak} days`}
                        />
                        <StatCard
                            title="Total Solved"
                            value={`${analytics.totalPuzzlesSolved}`}
                            unit="puzzles"
                            icon="✅"
                            color="green"
                            trend={+12}
                            subtitle={`${winRate}% completion rate`}
                        />
                        <StatCard
                            title="Total Points"
                            value={(analytics.totalPoints / 1000).toFixed(1)}
                            unit="k pts"
                            icon="⭐"
                            color="purple"
                            trend={+8}
                            subtitle={`Avg: ${avgScore.toLocaleString()} / puzzle`}
                        />
                        <StatCard
                            title="Avg Solve Time"
                            value={`${Math.floor(analytics.avgSolveTime / 60)}:${String(analytics.avgSolveTime % 60).padStart(2, '0')}`}
                            unit="min"
                            icon="⏱️"
                            color="cyan"
                            trend={-3}
                            subtitle={`Best: ${Math.floor(bestTime / 60)}m solve`}
                        />
                        <StatCard
                            title="Best Score"
                            value={bestScore.toLocaleString()}
                            unit="pts"
                            icon="🏆"
                            color="yellow"
                            subtitle="Personal record"
                        />
                        <StatCard
                            title="Achievements"
                            value={`${unlockedAchievements}`}
                            unit={`/ ${totalAchievements}`}
                            icon="🎖️"
                            color="pink"
                            subtitle={`${Math.round((unlockedAchievements / totalAchievements) * 100)}% unlocked`}
                        />
                    </div>

                    {/* Production Heatmap — IndexedDB + offline-first */}
                    <div className="section-card">
                        <div className="section-header">
                            <h2 className="section-title">📅 Activity Heatmap</h2>
                            <span className="section-badge">365-day view</span>
                        </div>
                        <HeatmapContainer />
                    </div>

                    {/* Two-column row */}
                    <div className="two-col-grid">
                        <div className="section-card">
                            <div className="section-header">
                                <h2 className="section-title">📆 Streak Calendar</h2>
                            </div>
                            <StreakCalendar scores={dailyScores} currentStreak={analytics.currentStreak} />
                        </div>
                        <div className="section-card">
                            <div className="section-header">
                                <h2 className="section-title">🧩 Type Breakdown</h2>
                            </div>
                            <PuzzleTypeBreakdown stats={puzzleTypeStats} />
                        </div>
                    </div>

                    {/* Insights */}
                    <InsightsPanel analytics={analytics} />
                </motion.div>
            )}

            {/* Performance Tab */}
            {viewMode === 'performance' && (
                <motion.div
                    key="performance"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    className="tab-content"
                >
                    <PerformanceChart scores={dailyScores} weekly={weeklyProgress} />
                </motion.div>
            )}


        </div>
    );
};

export default AnalyticsDashboard;
