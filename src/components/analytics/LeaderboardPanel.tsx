import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LeaderboardEntry } from '../../store/analyticsSlice';
import './LeaderboardPanel.css';

interface Props {
    entries: LeaderboardEntry[];
}

type Filter = 'global' | 'friends' | 'weekly';

const LeaderboardPanel: React.FC<Props> = ({ entries }) => {
    const [filter, setFilter] = useState<Filter>('global');

    const getRankStyle = (rank: number) => {
        if (rank === 1) return 'rank-gold';
        if (rank === 2) return 'rank-silver';
        if (rank === 3) return 'rank-bronze';
        return '';
    };

    const getRankIcon = (rank: number) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return `#${rank}`;
    };

    return (
        <div className="leaderboard-panel">
            {/* Header */}
            <div className="lb-header">
                <div>
                    <h2 className="lb-title">🏆 Global Leaderboard</h2>
                    <p className="lb-subtitle">Top puzzlers worldwide — resets monthly</p>
                </div>
                <div className="lb-filters">
                    {(['global', 'friends', 'weekly'] as Filter[]).map(f => (
                        <button
                            key={f}
                            className={`lb-filter ${filter === f ? 'active' : ''}`}
                            onClick={() => setFilter(f)}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Top 3 Podium */}
            <div className="podium">
                {[entries[1], entries[0], entries[2]].map((entry, i) => (
                    entry && (
                        <motion.div
                            key={entry.rank}
                            className={`podium-card ${i === 1 ? 'podium-first' : ''}`}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                        >
                            <div className="podium-rank-icon">{getRankIcon(entry.rank)}</div>
                            <div className={`podium-avatar ${i === 1 ? 'podium-avatar-large' : ''}`}
                                style={{ boxShadow: i === 1 ? '0 0 0 3px #F9CA24, 0 8px 32px rgba(249,202,36,0.4)' : '' }}>
                                {entry.avatar}
                            </div>
                            <div className="podium-username">{entry.username}</div>
                            <div className="podium-country">{entry.country}</div>
                            <div className="podium-score">{entry.score.toLocaleString()}</div>
                            <div className="podium-streak">🔥 {entry.streak}</div>
                        </motion.div>
                    )
                ))}
            </div>

            {/* Full List */}
            <div className="lb-list">
                <div className="lb-list-header">
                    <span>Rank</span>
                    <span>Player</span>
                    <span>Score</span>
                    <span>Streak</span>
                    <span>Country</span>
                </div>
                {entries.map((entry, idx) => (
                    <motion.div
                        key={entry.rank}
                        className={`lb-row ${entry.isCurrentUser ? 'current-user' : ''} ${getRankStyle(entry.rank)}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        whileHover={{ scale: 1.01, x: 4 }}
                    >
                        <div className="lb-rank">
                            {entry.rank <= 3
                                ? <span className="rank-medal">{getRankIcon(entry.rank)}</span>
                                : <span className="rank-num">{entry.rank}</span>
                            }
                        </div>
                        <div className="lb-player">
                            <div className="lb-avatar" style={{
                                background: entry.isCurrentUser
                                    ? 'linear-gradient(135deg, #7C3AED, #06B6D4)'
                                    : 'linear-gradient(135deg, #2D2D45, #1D1D30)'
                            }}>
                                {entry.avatar}
                            </div>
                            <div className="lb-player-info">
                                <span className="lb-username">
                                    {entry.username}
                                    {entry.isCurrentUser && <span className="you-badge">You</span>}
                                </span>
                            </div>
                        </div>
                        <div className="lb-score">{entry.score.toLocaleString()}</div>
                        <div className="lb-streak">
                            <span>🔥</span>
                            <span>{entry.streak}</span>
                        </div>
                        <div className="lb-country">{entry.country}</div>
                    </motion.div>
                ))}
            </div>

            {/* User's Position Summary */}
            <div className="lb-your-position">
                <div className="your-pos-left">
                    <span className="your-pos-rank">#7</span>
                    <div>
                        <div className="your-pos-label">Your Global Rank</div>
                        <div className="your-pos-sub">Top 7% of all players</div>
                    </div>
                </div>
                <div className="your-pos-right">
                    <div className="progress-to-next">
                        <div className="progress-label">
                            <span>Progress to #6</span>
                            <span>2,450 pts needed</span>
                        </div>
                        <div className="progress-bar-wrap">
                            <div className="progress-bar-fill" style={{ width: '65%' }}></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LeaderboardPanel;
