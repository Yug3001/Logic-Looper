import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store/store';
import { logout } from '../../store/authSlice';
import { togglePanel } from '../../store/notificationSlice';
import { auth } from '../../lib/apiClient';
import dayjs from 'dayjs';
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
    const [_copied, _setCopied] = React.useState(false); // kept for future use

    const today = dayjs().format('dddd, MMMM D, YYYY');
    const unreadCount = notifications.filter(n => !n.read).length;

    const displayInitials = user?.name
        ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
        : 'G';

    // Challenge Friend — opens the ChallengeRoomModal in GameView
    const handleShare = () => {
        window.dispatchEvent(new CustomEvent('ll:open-challenge'));
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
                {/* Challenge Friend button — opens room modal */}
                <button className="share-btn" onClick={handleShare} title="Challenge a friend with a 5-letter room code">
                    ⚔️ Challenge Friend
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
