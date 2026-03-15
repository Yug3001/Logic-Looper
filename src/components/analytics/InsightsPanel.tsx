import React from 'react';
import { motion } from 'framer-motion';
import { AnalyticsState } from '../../store/analyticsSlice';
import dayjs from 'dayjs';
import './InsightsPanel.css';

interface Props {
    analytics: AnalyticsState;
}

const InsightsPanel: React.FC<Props> = ({ analytics }) => {
    const scores = analytics.dailyScores || [];
    const puzzleTypeStats = analytics.puzzleTypeStats || [];
    const last7 = scores.filter(s => dayjs(s.date).isAfter(dayjs().subtract(7, 'day')));
    const prev7 = scores.filter(s =>
        dayjs(s.date).isAfter(dayjs().subtract(14, 'day')) &&
        dayjs(s.date).isBefore(dayjs().subtract(7, 'day'))
    );

    const avgLast7 = last7.length ? Math.round(last7.reduce((a, b) => a + b.score, 0) / last7.length) : 0;
    const avgPrev7 = prev7.length ? Math.round(prev7.reduce((a, b) => a + b.score, 0) / prev7.length) : 0;
    const scoreDelta = avgLast7 - avgPrev7;

    const bestHour = 'Evening'; // mocked for client-side
    const defaultType = { type: 'N/A', accuracy: 0, solved: 0, avgTime: 0, bestTime: 0, color: '#ccc' };
    const bestType = puzzleTypeStats.length > 0 
        ? puzzleTypeStats.reduce((a, b) => a.accuracy > b.accuracy ? a : b)
        : defaultType;
    const hintlessRun = scores.filter(s => s.hintsUsed === 0 && s.completed).length;

    const insights: { icon: string; title: string; value: string; sub: string; color: string }[] = [
        {
            icon: '📈',
            title: 'Score Momentum',
            value: `${scoreDelta >= 0 ? '+' : ''}${scoreDelta.toLocaleString()} pts`,
            sub: 'vs previous week',
            color: scoreDelta >= 0 ? '#10B981' : '#EF4444',
        },
        {
            icon: '⏰',
            title: 'Peak Performance',
            value: bestHour,
            sub: 'Your best solving time',
            color: '#F59E0B',
        },
        {
            icon: '🎯',
            title: 'Strongest Type',
            value: bestType.type,
            sub: `${bestType.accuracy}% accuracy`,
            color: '#7C3AED',
        },
        {
            icon: '💡',
            title: 'Hint-Free Solves',
            value: `${hintlessRun}`,
            sub: 'Puzzles without hints',
            color: '#06B6D4',
        },
        {
            icon: '🏆',
            title: 'Global Rank',
            value: '#7',
            sub: 'Top 7% worldwide',
            color: '#EC4899',
        },
        {
            icon: '📅',
            title: 'Longest Streak',
            value: `${analytics.longestStreak} days`,
            sub: 'Personal best',
            color: '#F97316',
        },
    ];

    const tips: string[] = [
        '🔥 You\'re on a roll! Complete today\'s puzzle to extend your streak.',
        '⚡ Your Sequence puzzles are your fastest — aim for sub-60s!',
        '🧠 Try solving Deduction puzzles without hints to boost your accuracy.',
        '📊 Your best scoring day was a Tuesday — keep that momentum going!',
    ];

    return (
        <div className="insights-panel">
            {/* Stats Row */}
            <div className="section-card">
                <div className="section-header">
                    <h2 className="section-title">💡 Performance Insights</h2>
                </div>
                <div className="insights-grid">
                    {insights.map((insight, i) => (
                        <motion.div
                            key={insight.title}
                            className="insight-card"
                            style={{ '--ins-color': insight.color } as any}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.06 }}
                            whileHover={{ y: -3 }}
                        >
                            <span className="insight-icon">{insight.icon}</span>
                            <div className="insight-body">
                                <div className="insight-title">{insight.title}</div>
                                <div className="insight-value">{insight.value}</div>
                                <div className="insight-sub">{insight.sub}</div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Tips */}
            <div className="section-card">
                <div className="section-header">
                    <h2 className="section-title">🚀 Smart Tips</h2>
                </div>
                <div className="tips-list">
                    {tips.map((tip, i) => (
                        <motion.div
                            key={i}
                            className="tip-item"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.08 }}
                        >
                            <div className="tip-index">{i + 1}</div>
                            <p className="tip-text">{tip}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default InsightsPanel;
