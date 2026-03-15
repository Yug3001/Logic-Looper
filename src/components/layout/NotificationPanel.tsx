import React, { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store/store';
import {
    markRead, markAllRead, removeNotification, clearAll, closePanel,
} from '../../store/notificationSlice';
import { motion, AnimatePresence } from 'framer-motion';
import './NotificationPanel.css';

const ICONS: Record<string, string> = {
    challenge: '⚔️',
    achievement: '🏆',
    streak: '🔥',
    system: 'ℹ️',
};

function formatTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000; // seconds
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    // Older — show date + time
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

const NotificationPanel: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { items, panelOpen } = useSelector((s: RootState) => s.notifications);
    const panelRef = useRef<HTMLDivElement>(null);

    const unread = items.filter(n => !n.read).length;

    // Close on outside click
    useEffect(() => {
        if (!panelOpen) return;
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                dispatch(closePanel());
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [panelOpen, dispatch]);

    return (
        <AnimatePresence>
            {panelOpen && (
                <motion.div
                    ref={panelRef}
                    className="notif-panel"
                    initial={{ opacity: 0, y: -12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                >
                    {/* Header */}
                    <div className="notif-panel-header">
                        <div className="notif-panel-title">
                            <span>🔔 Notifications</span>
                            {unread > 0 && <span className="notif-badge-count">{unread}</span>}
                        </div>
                        <div className="notif-panel-actions">
                            {unread > 0 && (
                                <button className="notif-action-btn" onClick={() => dispatch(markAllRead())}>
                                    Mark all read
                                </button>
                            )}
                            {items.length > 0 && (
                                <button className="notif-action-btn danger" onClick={() => dispatch(clearAll())}>
                                    Clear all
                                </button>
                            )}
                        </div>
                    </div>

                    {/* List */}
                    <div className="notif-list">
                        {items.length === 0 ? (
                            <div className="notif-empty">
                                <span>🎉</span>
                                <p>No notifications yet</p>
                                <small>Challenge requests & achievements appear here</small>
                            </div>
                        ) : (
                            <AnimatePresence initial={false}>
                                {items.map(n => (
                                    <motion.div
                                        key={n.id}
                                        className={`notif-item ${n.read ? 'read' : 'unread'} notif-type-${n.type}`}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                                        layout
                                        onClick={() => dispatch(markRead(n.id))}
                                    >
                                        <div className="notif-item-icon">{ICONS[n.type] ?? '💬'}</div>
                                        <div className="notif-item-body">
                                            <div className="notif-item-title">{n.title}</div>
                                            <div className="notif-item-message">{n.message}</div>
                                            <div className="notif-item-time">{formatTime(n.timestamp)}</div>
                                        </div>
                                        <button
                                            className="notif-remove-btn"
                                            onClick={(e) => { e.stopPropagation(); dispatch(removeNotification(n.id)); }}
                                            aria-label="Remove notification"
                                        >✕</button>
                                        {!n.read && <div className="notif-unread-dot" />}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default NotificationPanel;
