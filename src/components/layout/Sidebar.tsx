import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store/store';
import { logout } from '../../store/authSlice';
import { auth } from '../../lib/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import './Sidebar.css';

interface SidebarProps {
    currentTab: string;
    onTabChange: (tab: any) => void;
    isOpen: boolean;
    onToggle: () => void;
}

const navItems = [
    { id: 'game', icon: '🧩', label: 'Play Today', badge: '!' },
    { id: 'practice', icon: '♾️', label: 'Freeplay Archive', badge: null },
    { id: 'analytics', icon: '📊', label: 'Analytics', badge: null },
    { id: 'leaderboard', icon: '🏆', label: 'Leaderboard', badge: null },
    { id: 'achievements', icon: '🎖️', label: 'Achievements', badge: null },
];

const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange, isOpen, onToggle }) => {
    const dispatch = useDispatch<AppDispatch>();
    const analytics = useSelector((s: RootState) => s.analytics);
    const { user, isGuest } = useSelector((s: RootState) => s.auth);

    const displayName = user?.name ?? (isGuest ? 'Guest Player' : 'You');
    const displayAvatar = user?.name ? user.name.slice(0, 2).toUpperCase() : 'G';

    return (
        <motion.aside
            className={`sidebar ${isOpen ? 'open' : 'closed'}`}
            animate={{ width: isOpen ? 260 : 72 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
        >
            {/* Logo */}
            <div className="sidebar-logo" onClick={onToggle}>
                <div className="logo-icon"><span>∞</span></div>
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            className="logo-text"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            <span className="logo-name">Logic Looper</span>
                            <span className="logo-sub">Daily Puzzles</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Streak Banner */}
            <div className="sidebar-streak">
                <div className="streak-flame">🔥</div>
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            className="streak-info"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <span className="streak-count">{analytics.currentStreak}</span>
                            <span className="streak-label">day streak</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Nav Items */}
            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        className={`nav-item ${currentTab === item.id ? 'active' : ''}`}
                        onClick={() => onTabChange(item.id)}
                        data-tooltip={!isOpen ? item.label : undefined}
                    >
                        <span className="nav-icon">{item.icon}</span>
                        <AnimatePresence>
                            {isOpen && (
                                <motion.span
                                    className="nav-label"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0 }}
                                >
                                    {item.label}
                                </motion.span>
                            )}
                        </AnimatePresence>
                        {item.badge && currentTab !== item.id && (
                            <span className="nav-badge">{item.badge}</span>
                        )}
                        {currentTab === item.id && (
                            <motion.div className="nav-active-indicator" layoutId="activeTab" />
                        )}
                    </button>
                ))}
            </nav>

            {/* User Profile + Logout */}
            <div className="sidebar-user">
                <div className="user-avatar">{displayAvatar}</div>
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            className="user-info"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <span className="user-name">{displayName}</span>
                            <span className="user-rank">{isGuest ? 'Guest Mode' : `${user?.totalPoints?.toLocaleString() ?? 0} pts`}</span>
                        </motion.div>
                    )}
                </AnimatePresence>
                {isOpen && (
                    <button
                        className="logout-btn"
                        onClick={() => {
                            dispatch(logout());
                            auth.logout().catch(() => { });
                        }}
                        title="Sign out"
                    >
                        ↩
                    </button>
                )}
            </div>
        </motion.aside>
    );
};

export default Sidebar;
