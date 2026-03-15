import React from 'react';
import { motion } from 'framer-motion';
import './StatCard.css';

interface StatCardProps {
    title: string;
    value: string;
    unit?: string;
    icon: string;
    color: 'orange' | 'green' | 'purple' | 'cyan' | 'yellow' | 'pink';
    trend?: number;
    subtitle?: string;
}

const colorMap = {
    orange: { bg: 'rgba(245, 158, 11, 0.12)', accent: '#F59E0B', glow: 'rgba(245,158,11,0.3)' },
    green: { bg: 'rgba(16, 185, 129, 0.12)', accent: '#10B981', glow: 'rgba(16,185,129,0.3)' },
    purple: { bg: 'rgba(124, 58, 237, 0.12)', accent: '#7C3AED', glow: 'rgba(124,58,237,0.3)' },
    cyan: { bg: 'rgba(6, 182, 212, 0.12)', accent: '#06B6D4', glow: 'rgba(6,182,212,0.3)' },
    yellow: { bg: 'rgba(249, 202, 36, 0.12)', accent: '#F9CA24', glow: 'rgba(249,202,36,0.3)' },
    pink: { bg: 'rgba(236, 72, 153, 0.12)', accent: '#EC4899', glow: 'rgba(236,72,153,0.3)' },
};

const StatCard: React.FC<StatCardProps> = ({ title, value, unit, icon, color, trend, subtitle }) => {
    const c = colorMap[color];

    return (
        <motion.div
            className="stat-card"
            style={{ '--accent': c.accent, '--accent-bg': c.bg, '--accent-glow': c.glow } as any}
            whileHover={{ y: -4, scale: 1.01 }}
            transition={{ duration: 0.2 }}
        >
            <div className="stat-card-top">
                <div className="stat-icon-wrap">
                    <span className="stat-icon-emoji">{icon}</span>
                </div>
                {trend !== undefined && (
                    <div className={`stat-trend ${trend >= 0 ? 'positive' : 'negative'}`}>
                        <span>{trend >= 0 ? '↑' : '↓'}</span>
                        <span>{Math.abs(trend)}%</span>
                    </div>
                )}
            </div>

            <div className="stat-value-row">
                <span className="stat-value-num">{value}</span>
                {unit && <span className="stat-unit">{unit}</span>}
            </div>

            <div className="stat-meta">
                <span className="stat-title">{title}</span>
                {subtitle && <span className="stat-subtitle">{subtitle}</span>}
            </div>

            {/* Decorative glow bar */}
            <div className="stat-glow-bar"></div>
        </motion.div>
    );
};

export default StatCard;
