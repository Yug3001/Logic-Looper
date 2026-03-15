import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import './AchievementsPage.css';

const CATEGORIES = ['All', 'streak', 'speed', 'accuracy', 'milestone'] as const;
type Cat = typeof CATEGORIES[number];

const CAT_ICONS: Record<string, string> = {
    streak: '🔥', speed: '⚡', accuracy: '🎯', milestone: '🏅'
};

const AchievementsPage: React.FC = () => {
    const [filter, setFilter] = useState<Cat>('All');
    const { achievements } = useSelector((s: RootState) => s.analytics);

    const filtered = filter === 'All' ? achievements : achievements.filter(a => a.category === filter);
    const unlocked = achievements.filter(a => a.unlockedAt).length;

    return (
        <div className="achievements-page">
            {/* Header */}
            <motion.div
                className="ach-hero"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="ach-hero-left">
                    <h1>🎖️ Achievements</h1>
                    <p>Unlock badges by mastering daily puzzles</p>
                </div>
                <div className="ach-progress-wrap">
                    <div className="ach-progress-label">
                        <span>{unlocked} / {achievements.length} unlocked</span>
                        <span>{Math.round((unlocked / achievements.length) * 100)}%</span>
                    </div>
                    <div className="ach-progress-bar">
                        <motion.div
                            className="ach-progress-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${(unlocked / achievements.length) * 100}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                        />
                    </div>
                </div>
            </motion.div>

            {/* Category filter */}
            <div className="ach-filters">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        className={`ach-filter-btn ${filter === cat ? 'ach-filter-active' : ''}`}
                        onClick={() => setFilter(cat)}
                    >
                        {cat !== 'All' && CAT_ICONS[cat]}
                        {' '}{cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                ))}
            </div>

            {/* Achievement Grid */}
            <div className="ach-grid">
                {filtered.map((ach, i) => (
                    <motion.div
                        key={ach.id}
                        className={`ach-card ${ach.unlockedAt ? 'ach-unlocked' : 'ach-locked'}`}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        whileHover={{ scale: ach.unlockedAt ? 1.03 : 1 }}
                    >
                        <div className="ach-icon-wrap">
                            <span className="ach-icon">{ach.icon}</span>
                            {!ach.unlockedAt && <div className="ach-lock">🔒</div>}
                        </div>
                        <div className="ach-info">
                            <div className="ach-title">{ach.title}</div>
                            <div className="ach-desc">{ach.description}</div>
                            {ach.unlockedAt && (
                                <div className="ach-date">
                                    Unlocked {new Date(ach.unlockedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                            )}
                            <div className={`ach-category-tag ach-cat-${ach.category}`}>
                                {CAT_ICONS[ach.category]} {ach.category}
                            </div>
                        </div>
                        {ach.unlockedAt && <div className="ach-check">✓</div>}
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default AchievementsPage;
