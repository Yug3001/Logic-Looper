/**
 * AchievementToast — slides in from bottom-right when new achievements unlock
 */
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ACHIEVEMENTS } from '../../lib/achievementEngine';
import './AchievementToast.css';

interface AchievementToastProps {
    achievementIds: string[];
    onDismiss: () => void;
}

const AchievementToast: React.FC<AchievementToastProps> = ({ achievementIds, onDismiss }) => {
    useEffect(() => {
        const t = setTimeout(onDismiss, 5000);
        return () => clearTimeout(t);
    }, [onDismiss]);

    const defs = achievementIds
        .map(id => ACHIEVEMENTS.find(a => a.id === id))
        .filter(Boolean) as typeof ACHIEVEMENTS;

    const categoryColors: Record<string, string> = {
        streak: '#F59E0B',
        speed: '#06B6D4',
        accuracy: '#10B981',
        milestone: '#7C3AED',
    };

    return (
        <div className="ach-toasts">
            {defs.map((def, i) => (
                <motion.div
                    key={def.id}
                    className="ach-toast"
                    style={{ '--cat-col': categoryColors[def.category] } as any}
                    initial={{ x: 120, opacity: 0, scale: 0.9 }}
                    animate={{ x: 0, opacity: 1, scale: 1 }}
                    exit={{ x: 120, opacity: 0 }}
                    transition={{ delay: i * 0.15, type: 'spring', stiffness: 260, damping: 22 }}
                >
                    <div className="ach-toast-icon-wrap">
                        <span className="ach-toast-icon">{def.icon}</span>
                        <div className="ach-toast-glow" />
                    </div>
                    <div className="ach-toast-body">
                        <div className="ach-toast-title">Achievement Unlocked!</div>
                        <div className="ach-toast-name">{def.title}</div>
                        <div className="ach-toast-desc">{def.description}</div>
                    </div>
                    <button className="ach-toast-close" onClick={onDismiss}>✕</button>
                </motion.div>
            ))}
        </div>
    );
};

export default AchievementToast;
