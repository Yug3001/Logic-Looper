/**
 * MilestoneCelebration — full-screen overlay for streak milestones
 */
import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { MilestoneBadge } from '../../hooks/useHeatmap';
import './MilestoneCelebration.css';

interface MilestoneCelebrationProps {
    badge: MilestoneBadge;
    streak: number;
    onDismiss: () => void;
}

const MilestoneCelebration: React.FC<MilestoneCelebrationProps> = ({ badge, streak, onDismiss }) => {
    useEffect(() => {
        const t = setTimeout(onDismiss, 4000);
        return () => clearTimeout(t);
    }, [onDismiss]);

    // Confetti particles
    const particles = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        size: 6 + Math.random() * 8,
        color: [badge.color, '#F59E0B', '#EC4899', '#06B6D4', '#10B981'][i % 5],
    }));

    return (
        <motion.div
            className="milestone-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDismiss}
        >
            {/* Confetti */}
            {particles.map(p => (
                <motion.div
                    key={p.id}
                    className="milestone-particle"
                    style={{
                        left: `${p.x}%`,
                        width: p.size,
                        height: p.size,
                        background: p.color,
                    }}
                    initial={{ y: -20, opacity: 1, rotate: 0 }}
                    animate={{ y: '110vh', opacity: 0, rotate: 360 * (Math.random() > 0.5 ? 1 : -1) }}
                    transition={{ duration: 3, delay: p.delay, ease: 'easeIn' }}
                />
            ))}

            {/* Card */}
            <motion.div
                className="milestone-card"
                initial={{ scale: 0.5, opacity: 0, y: 40 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                onClick={(e) => e.stopPropagation()}
            >
                <motion.div
                    className="milestone-emoji"
                    animate={{ rotate: [0, -15, 15, -10, 10, 0], scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                >
                    {badge.emoji}
                </motion.div>
                <h2 className="milestone-title" style={{ color: badge.color }}>
                    {badge.label}
                </h2>
                <p className="milestone-sub">
                    You've maintained a <strong>{streak}-day streak!</strong><br />
                    Incredible discipline! 🏆
                </p>
                <div className="milestone-streak-ring" style={{ '--ring-color': badge.color } as any}>
                    <span className="milestone-streak-num">{streak}</span>
                    <span className="milestone-streak-days">DAYS</span>
                </div>
                <button className="milestone-dismiss" onClick={onDismiss}>
                    Keep going! 🔥
                </button>
            </motion.div>
        </motion.div>
    );
};

export default MilestoneCelebration;
