import React from 'react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { PuzzleTypeStat } from '../../store/analyticsSlice';
import './PuzzleTypeBreakdown.css';

interface Props {
    stats: PuzzleTypeStat[];
}

const PuzzleTypeBreakdown: React.FC<Props> = ({ stats }) => {
    const radarData = stats.map(s => ({
        subject: (s.type || 'Unknown').split(' ')[0],
        accuracy: s.accuracy || 0,
        solved: Math.round(((s.solved || 0) / Math.max(1, ...stats.map(x => x.solved || 0))) * 100) || 0,
        speed: Math.round((1 - (s.avgTime || 0) / (Math.max(0, ...stats.map(x => x.avgTime || 0)) + 1)) * 100) || 0,
    }));

    return (
        <div className="type-breakdown">
            {/* Radar Chart */}
            <div className="radar-wrap">
                <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarData}>
                        <PolarGrid stroke="rgba(255,255,255,0.06)" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#A09DC0', fontSize: 12 }} />
                        <Radar name="Accuracy" dataKey="accuracy" stroke="#7C3AED" fill="#7C3AED" fillOpacity={0.2} strokeWidth={2} />
                        <Radar name="Speed" dataKey="speed" stroke="#06B6D4" fill="#06B6D4" fillOpacity={0.15} strokeWidth={2} />
                        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                    </RadarChart>
                </ResponsiveContainer>
                <div className="radar-legend">
                    <div className="radar-legend-item">
                        <span className="radar-dot" style={{ background: '#7C3AED' }}></span>
                        <span>Accuracy</span>
                    </div>
                    <div className="radar-legend-item">
                        <span className="radar-dot" style={{ background: '#06B6D4' }}></span>
                        <span>Speed</span>
                    </div>
                </div>
            </div>

            {/* Type List */}
            <div className="type-list">
                {stats.map((s) => (
                    <div key={s.type} className="type-item">
                        <div className="type-dot" style={{ background: s.color }}></div>
                        <div className="type-info">
                            <div className="type-name">{s.type}</div>
                            <div className="type-bar-wrap">
                                <div className="type-bar" style={{ width: `${s.accuracy}%`, background: s.color }}></div>
                            </div>
                        </div>
                        <div className="type-stats">
                            <span className="type-stat-val">{s.accuracy}%</span>
                            <span className="type-stat-label">{s.solved} solved</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PuzzleTypeBreakdown;
