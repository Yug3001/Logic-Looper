import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store/store';
import { logout } from '../../store/authSlice';
import { togglePanel } from '../../store/notificationSlice';
import { auth } from '../../lib/apiClient';
import dayjs from 'dayjs';
import { getDailyPuzzleConfig } from '../../lib/puzzleEngine';
import { formatDateLocal } from '../../lib/db';
import NotificationPanel from './NotificationPanel';
import './Topbar.css';

interface TopbarProps {
    onMenuToggle: () => void;
}

const Topbar: React.FC<TopbarProps> = ({ onMenuToggle }) => {
    const dispatch = useDispatch<AppDispatch>();
    const analytics = useSelector((s: RootState) => s.analytics);
    const { user } = useSelector((s: RootState) => s.auth);
    const { items: notifications } = useSelector((s: RootState) => s.notifications);
    const [copied, setCopied] = React.useState(false);

    const today = dayjs().format('dddd, MMMM D, YYYY');
    const unreadCount = notifications.filter(n => !n.read).length;

    const displayInitials = user?.name
        ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
        : 'G';

    // Friend Challenge — share today's puzzle seed via URL
    const handleShare = async () => {
        const date = formatDateLocal(new Date());
        const config = getDailyPuzzleConfig(date);
        const shareUrl = `${window.location.origin}?puzzle=${date}&seed=${config.seed}&type=${config.type}`;
        try {
            if (navigator.share) {
                await navigator.share({
                    title: `Logic Looper — ${today}`,
                    text: `Can you solve today's ${config.type} puzzle? 🧩`,
                    url: shareUrl,
                });
            } else {
                await navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        } catch { /* user cancelled */ }
    };

    return (
        <header className="topbar">
            <div className="topbar-left">
                <button className="menu-toggle" onClick={onMenuToggle} aria-label="Toggle menu">
                    <span></span><span></span><span></span>
                </button>
                <div className="topbar-date">
                    <span className="today-label">Today's Puzzle</span>
                    {/* Removed puzzle number (#438) — only show date */}
                    <span className="today-date">{today}</span>
                </div>
            </div>

            <div className="topbar-right">
                {/* Friend Challenge Share Button */}
                <button className="share-btn" onClick={handleShare} title="Share today's puzzle with a friend">
                    {copied ? '✅ Copied!' : '🔗 Challenge Friend'}
                </button>

                <div className="topbar-stat">
                    <span className="stat-icon">🔥</span>
                    <span className="stat-value">{analytics.currentStreak}</span>
                    <span className="stat-label">streak</span>
                </div>
                <div className="topbar-stat">
                    <span className="stat-icon">⭐</span>
                    <span className="stat-value">{analytics.totalPoints}</span>
                    <span className="stat-label">pts</span>
                </div>

                {/* Active Notification Bell */}
                <div className="topbar-notif" onClick={() => dispatch(togglePanel())} title="Notifications">
                    <span>🔔</span>
                    {unreadCount > 0 && (
                        <span className="notif-dot">
                            {unreadCount > 9 ? '9+' : unreadCount > 1 ? unreadCount : ''}
                        </span>
                    )}
                    <NotificationPanel />
                </div>

                <div className="topbar-avatar" title={user?.name || 'Guest user'}>{displayInitials}</div>
                <button
                    className="topbar-logout-btn"
                    onClick={() => {
                        dispatch(logout());
                        auth.logout().catch(() => { });
                    }}
                    title="Sign Out"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    <span className="logout-text">Logout</span>
                </button>
            </div>
        </header>
    );
};

export default Topbar;
