import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Achievement } from '../../store/analyticsSlice';
import dayjs from 'dayjs';
import './AchievementsGrid.css';

interface Props {
    achievements: Achievement[];
}

type Category = 'all' | 'streak' | 'speed' | 'accuracy' | 'milestone';

const categoryColors: Record<string, string> = {
    streak: '#F59E0B',
    speed: '#06B6D4',
    accuracy: '#10B981',
    milestone: '#7C3AED',
};

const AchievementsGrid: React.FC<Props> = ({ achievements }) => {
    const [filter, setFilter] = useState<Category>('all');

    const filtered = filter === 'all'
        ? achievements
        : achievements.filter(a => a.category === filter);

    const unlocked = achievements.filter(a => a.unlockedAt).length;
    const total = achievements.length;

    return (
        <div className="achievements-panel">
            {/* Summary Bar */}
            <div className="achievements-summary">
                <div className="ach-progress-circle">
                    <svg viewBox="0 0 64 64" width="64" height="64">
                        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                        <circle
                            cx="32" cy="32" r="28"
                            fill="none"
                            stroke="#7C3AED"
                            strokeWidth="6"
                            strokeDasharray={`${2 * Math.PI * 28 * unlocked / total} ${2 * Math.PI * 28}`}
                            strokeLinecap="round"
                            strokeDashoffset={2 * Math.PI * 28 * 0.25}
                            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                        />
                    </svg>
                    <span className="ach-progress-num">{Math.round(unlocked / total * 100)}%</span>
                </div>
                <div className="ach-summary-text">
                    <div className="ach-count">{unlocked} / {total} <span>Unlocked</span></div>
                    <div className="ach-sub">Keep playing to unlock more achievements</div>
                    <div className="ach-category-stats">
                        {(['streak', 'speed', 'accuracy', 'milestone'] as const).map(cat => {
                            const catTotal = achievements.filter(a => a.category === cat).length;
                            const catUnlocked = achievements.filter(a => a.category === cat && a.unlockedAt).length;
                            return (
                                <div key={cat} className="ach-cat-stat">
                                    <span className="ach-cat-dot" style={{ background: categoryColors[cat] }}></span>
                                    <span className="ach-cat-name">{cat}</span>
                                    <span className="ach-cat-num">{catUnlocked}/{catTotal}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="ach-filters">
                {(['all', 'streak', 'speed', 'accuracy', 'milestone'] as Category[]).map(f => (
                    <button
                        key={f}
                        className={`ach-filter ${filter === f ? 'active' : ''}`}
                        style={filter === f && f !== 'all' ? { background: categoryColors[f] + '33', color: categoryColors[f], borderColor: categoryColors[f] + '66' } : {}}
                        onClick={() => setFilter(f)}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
            </div>

            {/* Grid */}
            <div className="ach-grid">
                {filtered.map((ach, i) => (
                    <motion.div
                        key={ach.id}
                        className={`ach-card ${ach.unlockedAt ? 'unlocked' : 'locked'}`}
                        style={{ '--cat-color': categoryColors[ach.category] } as any}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.04 }}
                        whileHover={{ y: -4, scale: 1.02 }}
                    >
                        <div className={`ach-icon-wrap ${ach.unlockedAt ? '' : 'grayscale'}`}>
                            <span className="ach-icon">{ach.icon}</span>
                            {ach.unlockedAt && (
                                <motion.div
                                    className="ach-glow"
                                    animate={{ opacity: [0.3, 0.8, 0.3] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                />
                            )}
                        </div>

                        <div className="ach-body">
                            <div className="ach-title">{ach.title}</div>
                            <div className="ach-desc">{ach.description}</div>
                            <div className="ach-footer">
                                <span
                                    className="ach-category-tag"
                                    style={{ background: categoryColors[ach.category] + '22', color: categoryColors[ach.category] }}
                                >
                                    {ach.category}
                                </span>
                                {ach.unlockedAt && (
                                    <span className="ach-date">
                                        {dayjs(ach.unlockedAt).format('MMM D')}
                                    </span>
                                )}
                                {!ach.unlockedAt && (
                                    <span className="ach-locked-label">🔒 Locked</span>
                                )}
                            </div>
                        </div>

                        {!ach.unlockedAt && <div className="ach-lock-overlay" />}
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default AchievementsGrid;
