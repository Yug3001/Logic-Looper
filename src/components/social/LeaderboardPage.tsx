/**
 * LeaderboardPage — Multi-tab leaderboard with real-time live battle feed
 *
 * Tabs:
 *  🌍 Global  — all-time top 100
 *  📅 Daily   — today's top completions
 *  ⚔️ Friends  — recent challenge history with shareable link
 *  🔴 Live    — real-time active battles + solo sessions via Socket.io
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { getLbLiveService, destroyLbLiveService } from '../../lib/leaderboardLiveService';
import type { RoomSnapshot, PlayerSnap } from '../../lib/lbTypes';
import { formatDateLocal } from '../../lib/db';
import './LeaderboardPage.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ['Global', 'Daily', 'Friends', 'Live'] as const;
type Tab = typeof TABS[number];

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const DIFF_LABEL = ['Easy', 'Medium', 'Hard', 'Expert'];
const DIFF_COLOR = ['#10B981', '#F59E0B', '#F97316', '#EF4444'];
const TYPE_ICONS: Record<string, string> = {
    matrix: '🔢', sequence: '📐', pattern: '🎨', binary: '💻', deduction: '🔍',
};

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const avatarLetter = (name: string) => name?.charAt(0)?.toUpperCase() ?? '?';

// ─── Mock global leaderboard data ────────────────────────────────────────────

interface GlobalEntry {
    rank: number;
    userId: string;
    name: string;
    initials: string;
    avatar?: string | null;
    totalPoints: number;
    streakCount: number;
    country: string;
    puzzlesSolved: number;
    isMe?: boolean;
    avatarColor: string;
}

const AVATAR_COLORS = [
    'linear-gradient(135deg,#7c3aed,#a855f7)',
    'linear-gradient(135deg,#0ea5e9,#06b6d4)',
    'linear-gradient(135deg,#ec4899,#f43f5e)',
    'linear-gradient(135deg,#10b981,#14b8a6)',
    'linear-gradient(135deg,#f59e0b,#f97316)',
    'linear-gradient(135deg,#6366f1,#8b5cf6)',
    'linear-gradient(135deg,#14b8a6,#22d3ee)',
    'linear-gradient(135deg,#f43f5e,#fb923c)',
];

// ─── Component ────────────────────────────────────────────────────────────────

const LeaderboardPage: React.FC = () => {
    const { user } = useSelector((s: RootState) => s.auth);
    const analytics = useSelector((s: RootState) => s.analytics);
    const { currentStreak, totalPoints, totalPuzzlesSolved, dailyScores } = analytics;

    const [activeTab, setActiveTab] = useState<Tab>('Global');
    const [liveRooms, setLiveRooms] = useState<RoomSnapshot[]>([]);
    const [lbConnected, setLbConnected] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [copyOk, setCopyOk] = useState(false);
    const [liveFilter, setLiveFilter] = useState<'all' | 'challenge' | 'solo'>('all');
    const [highlightedRoom, setHighlightedRoom] = useState<string | null>(null);
    const pulseRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const today = formatDateLocal(new Date());

    const myGlobalEntry: GlobalEntry = {
        rank: 1,
        userId: user?.id || 'you',
        name: user?.name || 'You',
        initials: avatarLetter(user?.name || 'You'),
        totalPoints,
        streakCount: currentStreak,
        country: '🏠 Local Player',
        puzzlesSolved: totalPuzzlesSolved,
        avatarColor: AVATAR_COLORS[6],
        isMe: true
    };

    const todayScore = dailyScores.find(s => s.date === today)?.score || 0;
    const todaySolved = dailyScores.some(s => s.date === today && s.completed) ? 1 : 0;
    
    // Default to empty array if no points today, else show the user
    const dailyData: GlobalEntry[] = todayScore > 0 ? [{
        ...myGlobalEntry,
        totalPoints: todayScore,
        puzzlesSolved: todaySolved,
    }] : [];

    const globalData: GlobalEntry[] = [myGlobalEntry];

    // ── Connect to live leaderboard socket ───────────────────────────────────
    useEffect(() => {
        if (activeTab !== 'Live') return;

        const svc = getLbLiveService();

        svc.connect().then(() => {
            setLbConnected(svc.connected);
        });

        const offSnap = svc.onSnapshot((data) => {
            setLiveRooms(data.rooms);
            setLastUpdated(new Date());
            setLbConnected(true);
        });

        const offUpdate = svc.onUpdate((data) => {
            // Highlight newly completed battles
            if (data.type === 'completion') {
                setHighlightedRoom(data.roomId);
                clearTimeout(pulseRef.current);
                pulseRef.current = setTimeout(() => setHighlightedRoom(null), 3000);
            }
            svc.requestRefresh();
        });

        return () => {
            offSnap();
            offUpdate();
        };
    }, [activeTab]);

    // Auto-refresh when on Live tab
    useEffect(() => {
        if (activeTab !== 'Live') return;
        const interval = setInterval(() => {
            getLbLiveService().requestRefresh();
        }, 5000);
        return () => clearInterval(interval);
    }, [activeTab]);

    // Filter rooms for Live tab
    const filteredRooms = liveFilter === 'all'
        ? liveRooms
        : liveRooms.filter(r => r.mode === liveFilter);

    const activeBattles = liveRooms.filter(r => r.mode === 'challenge' && !r.allFinished && r.players.length === 2);
    const activeSolo = liveRooms.filter(r => r.mode === 'solo' && !r.allFinished);
    const recentFinished = liveRooms.filter(r => r.allFinished);

    const handleCopyLink = useCallback(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('challenge', Math.random().toString(36).slice(2, 8).toUpperCase());
        url.searchParams.set('date', today);
        navigator.clipboard.writeText(url.toString());
        setCopyOk(true);
        setTimeout(() => setCopyOk(false), 2000);
    }, [today]);

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="leaderboard-page">
            {/* Hero */}
            <motion.div
                className="lb-hero"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="lb-hero-icon">🏆</div>
                <div className="lb-hero-text">
                    <h1>
                        {activeTab === 'Live' && '🔴 Live Arena'}
                        {activeTab === 'Global' && 'Global Leaderboard'}
                        {activeTab === 'Daily' && "Today's Champions"}
                        {activeTab === 'Friends' && 'Friend Challenges'}
                    </h1>
                    <p>
                        {activeTab === 'Live' && 'Watch real-time battles and solo solvers — updated live'}
                        {activeTab === 'Global' && 'Top 100 solvers ranked by all-time points'}
                        {activeTab === 'Daily' && `Best scores for ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
                        {activeTab === 'Friends' && 'Compete head-to-head with a shareable puzzle link'}
                    </p>
                </div>
                <div className="lb-your-rank">
                    <span className="rank-label">Your Rank</span>
                    <span className="rank-value">#7</span>
                    <span className="rank-streak">🔥 {currentStreak} day streak</span>
                </div>
            </motion.div>

            {/* Tabs */}
            <div className="lb-tabs">
                {TABS.map(tab => (
                    <button
                        key={tab}
                        className={`lb-tab ${activeTab === tab ? 'lb-tab-active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                        id={`lb-tab-${tab.toLowerCase()}`}
                    >
                        {tab === 'Global' && '🌍 '}
                        {tab === 'Daily' && '📅 '}
                        {tab === 'Friends' && '⚔️ '}
                        {tab === 'Live' && (
                            <span className="lb-live-dot-wrap">
                                <span className="lb-live-dot" />
                            </span>
                        )}
                        {tab}
                        {tab === 'Live' && (
                            <span className="lb-live-count">{activeBattles.length + activeSolo.length}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── GLOBAL ── */}
            <AnimatePresence mode="wait">
                {activeTab === 'Global' && (
                    <motion.div
                        key="global"
                        className="lb-table-wrap"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                    >
                        {/* Top podium */}
                        <div className="lb-podium">
                            {[globalData[1], globalData[0], globalData[2]].map((e, i) => {
                                if (!e) return <div key={`empty-${i}`} className={`podium-slot pos-${i}`} />;
                                return (
                                <div key={e.userId} className={`podium-slot pos-${i}`}>
                                    <div className="podium-avatar-wrap">
                                        <div className="podium-avatar" style={{ background: e.avatarColor }}>
                                            {e.initials}
                                        </div>
                                        <span className="podium-medal">{i === 1 ? '🥇' : i === 0 ? '🥈' : '🥉'}</span>
                                    </div>
                                    <span className="podium-name">{e.name}</span>
                                    <span className="podium-pts">{e.totalPoints.toLocaleString()}</span>
                                </div>
                                );
                            })}
                        </div>

                        <div className="lb-table">
                            <div className="lb-row lb-header">
                                <span>Rank</span>
                                <span>Player</span>
                                <span className="lb-score-header">Points</span>
                                <span className="lb-streak">Streak</span>
                                <span className="lb-solved">Solved</span>
                                <span className="lb-country"></span>
                            </div>
                            {globalData.map((e, i) => (
                                <motion.div
                                    key={e.userId}
                                    className={`lb-row ${e.isMe ? 'lb-row-you' : ''} ${e.rank <= 3 ? 'lb-row-top3' : ''}`}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                >
                                    <span className="lb-rank">{MEDALS[e.rank] ?? `#${e.rank}`}</span>
                                    <span className="lb-player">
                                        <div className="lb-avatar" style={{ background: e.avatarColor }}>{e.initials}</div>
                                        <div className="lb-player-info">
                                            <span className="lb-username">{e.name}</span>
                                            {e.isMe && <span className="lb-you-tag">YOU</span>}
                                        </div>
                                    </span>
                                    <span className="lb-score">{e.totalPoints.toLocaleString()}</span>
                                    <span className="lb-streak">🔥 {e.streakCount}</span>
                                    <span className="lb-solved">{e.puzzlesSolved}</span>
                                    <span className="lb-country">{e.country}</span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ── DAILY ── */}
                {activeTab === 'Daily' && (
                    <motion.div
                        key="daily"
                        className="lb-table-wrap"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="lb-daily-banner">
                            <span>📅 {today}</span>
                            <span className="lb-daily-count">{dailyData.length} solvers today</span>
                        </div>
                        <div className="lb-table">
                            <div className="lb-row lb-row-daily lb-header">
                                <span>Rank</span>
                                <span>Player</span>
                                <span className="lb-score-header">Score</span>
                                <span className="lb-streak">Streak</span>
                                <span className="lb-country"></span>
                            </div>
                            {dailyData.map((e, i) => (
                                <motion.div
                                    key={e.userId}
                                    className={`lb-row lb-row-daily ${e.isMe ? 'lb-row-you' : ''}`}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                >
                                    <span className="lb-rank">{MEDALS[e.rank] ?? `#${e.rank}`}</span>
                                    <span className="lb-player">
                                        <div className="lb-avatar" style={{ background: e.avatarColor }}>{e.initials}</div>
                                        <div className="lb-player-info">
                                            <span className="lb-username">{e.name}</span>
                                            {e.isMe && <span className="lb-you-tag">YOU</span>}
                                        </div>
                                    </span>
                                    <span className="lb-score">{e.totalPoints.toLocaleString()}</span>
                                    <span className="lb-streak">🔥 {e.streakCount}</span>
                                    <span className="lb-country">{e.country}</span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ── FRIENDS ── */}
                {activeTab === 'Friends' && (
                    <motion.div
                        key="friends"
                        className="lb-friends-wrap"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                    >
                        {/* Share card */}
                        <div className="lb-friends-share">
                            <div className="lb-fs-icon">⚔️</div>
                            <div className="lb-fs-text">
                                <h3>Challenge a Friend Right Now</h3>
                                <p>Generate a unique challenge link — your friend opens it and you both race on the same puzzle in real-time.</p>
                            </div>
                            <motion.button
                                className="btn-share-friends"
                                onClick={handleCopyLink}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                            >
                                {copyOk ? '✓ Link Copied!' : '🔗 Copy Challenge Link'}
                            </motion.button>
                        </div>

                        {/* How it works */}
                        <div className="lb-how-it-works">
                            <h4>How it works</h4>
                            <div className="lb-hiw-steps">
                                <div className="lb-hiw-step">
                                    <span className="lb-hiw-num">1</span>
                                    <div>
                                        <strong>Open the Game tab</strong>
                                        <p>Click the ⚔️ button in the puzzle header</p>
                                    </div>
                                </div>
                                <div className="lb-hiw-step">
                                    <span className="lb-hiw-num">2</span>
                                    <div>
                                        <strong>Create a Challenge</strong>
                                        <p>Get a shareable room link</p>
                                    </div>
                                </div>
                                <div className="lb-hiw-step">
                                    <span className="lb-hiw-num">3</span>
                                    <div>
                                        <strong>Race in Real-Time</strong>
                                        <p>Watch each other's live progress bars</p>
                                    </div>
                                </div>
                                <div className="lb-hiw-step">
                                    <span className="lb-hiw-num">4</span>
                                    <div>
                                        <strong>See Results</strong>
                                        <p>Compare scores on the Live tab</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tip about Live tab */}
                        <div className="lb-friends-tip">
                            <span>💡</span>
                            <span>After challenging friends, switch to the <strong>🔴 Live</strong> tab to watch ongoing battles in real-time!</span>
                        </div>
                    </motion.div>
                )}

                {/* ── LIVE ── */}
                {activeTab === 'Live' && (
                    <motion.div
                        key="live"
                        className="lb-live-wrap"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                    >
                        {/* Status bar */}
                        <div className="lb-live-statusbar">
                            <div className="lb-live-status">
                                <span className={`lb-live-indicator ${lbConnected ? 'connected' : 'disconnected'}`} />
                                <span>{lbConnected ? 'Live — Connected' : 'Connecting…'}</span>
                                {lastUpdated && (
                                    <span className="lb-last-updated">
                                        Updated {lastUpdated.toLocaleTimeString()}
                                    </span>
                                )}
                            </div>
                            <div className="lb-live-filters">
                                {(['all', 'challenge', 'solo'] as const).map(f => (
                                    <button
                                        key={f}
                                        className={`lb-filter-btn ${liveFilter === f ? 'active' : ''}`}
                                        onClick={() => setLiveFilter(f)}
                                    >
                                        {f === 'all' && `All (${liveRooms.length})`}
                                        {f === 'challenge' && `⚔️ Battles (${activeBattles.length})`}
                                        {f === 'solo' && `🎮 Solo (${activeSolo.length})`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Stats row */}
                        <div className="lb-live-stats">
                            <div className="lb-ls-card">
                                <span className="lb-ls-num">{activeBattles.length + activeSolo.length}</span>
                                <span className="lb-ls-label">Active Now</span>
                            </div>
                            <div className="lb-ls-card challenge">
                                <span className="lb-ls-num">{activeBattles.length}</span>
                                <span className="lb-ls-label">⚔️ Live Battles</span>
                            </div>
                            <div className="lb-ls-card solo">
                                <span className="lb-ls-num">{activeSolo.length}</span>
                                <span className="lb-ls-label">🎮 Solo Players</span>
                            </div>
                            <div className="lb-ls-card finished">
                                <span className="lb-ls-num">{recentFinished.length}</span>
                                <span className="lb-ls-label">✅ Just Finished</span>
                            </div>
                        </div>

                        {/* No sessions yet */}
                        {filteredRooms.length === 0 && (
                            <div className="lb-live-empty">
                                <div className="lb-live-empty-icon">
                                    {lbConnected ? '⚔️' : '📡'}
                                </div>
                                <h3>{lbConnected ? 'No active sessions right now' : 'Connecting to live feed…'}</h3>
                                <p>
                                    {lbConnected
                                        ? 'Start a puzzle to appear here, or challenge a friend to create a live battle!'
                                        : 'Please wait while we connect to the real-time server.'}
                                </p>
                                {lbConnected && (
                                    <AnimatePresence>
                                        <DemoRooms />
                                    </AnimatePresence>
                                )}
                            </div>
                        )}

                        {/* Live room cards */}
                        <div className="lb-live-rooms">
                            {filteredRooms.map((room, i) => (
                                <LiveRoomCard
                                    key={room.id}
                                    room={room}
                                    myUserId={user?.id}
                                    highlighted={room.id === highlightedRoom}
                                    delay={i * 0.05}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ─── Live Room Card ───────────────────────────────────────────────────────────

const LiveRoomCard: React.FC<{
    room: RoomSnapshot;
    myUserId?: string;
    highlighted: boolean;
    delay: number;
}> = ({ room, myUserId, highlighted, delay }) => {
    const isChallenge = room.mode === 'challenge';
    const elapsed = room.startedAt ? Math.floor((Date.now() - room.startedAt) / 1000) : 0;
    const [timer, setTimer] = useState(elapsed);
    const hasMe = room.players.some(p => p.userId === myUserId);

    useEffect(() => {
        if (room.allFinished || !room.startedAt) return;
        const t = setInterval(() => {
            setTimer(Math.floor((Date.now() - room.startedAt!) / 1000));
        }, 1000);
        return () => clearInterval(t);
    }, [room.startedAt, room.allFinished]);

    return (
        <motion.div
            className={`lb-room-card ${isChallenge ? 'challenge' : 'solo'} ${room.allFinished ? 'finished' : ''} ${highlighted ? 'highlighted' : ''} ${hasMe ? 'has-me' : ''}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            layout
        >
            <div className="lb-room-header">
                <div className="lb-room-mode">
                    <span className="lb-room-mode-badge" style={{ background: isChallenge ? 'rgba(124,58,237,0.15)' : 'rgba(6,182,212,0.12)', color: isChallenge ? '#a78bfa' : '#22d3ee', border: `1px solid ${isChallenge ? '#7c3aed44' : '#06b6d444'}` }}>
                        {isChallenge ? '⚔️ Challenge' : '🎮 Solo'}
                    </span>
                    <span className="lb-room-type">
                        {TYPE_ICONS[room.puzzleType] ?? '🧩'} {room.puzzleType}
                    </span>
                    <span className="lb-room-diff" style={{ color: DIFF_COLOR[room.difficulty] }}>
                        {DIFF_LABEL[room.difficulty]}
                    </span>
                </div>
                <div className="lb-room-meta">
                    {hasMe && <span className="lb-room-you-badge">👤 You</span>}
                    {room.allFinished
                        ? <span className="lb-room-done">✅ Finished</span>
                        : <span className="lb-room-timer">⏱ {fmtTime(timer)}</span>
                    }
                </div>
            </div>

            {/* Players */}
            <div className={`lb-room-players ${isChallenge ? 'vs-layout' : ''}`}>
                {room.players.map((player, idx) => (
                    <React.Fragment key={player.userId}>
                        <LivePlayerBar
                            player={player}
                            isMe={player.userId === myUserId}
                            color={isChallenge ? (idx === 0 ? '#7c3aed' : '#ec4899') : '#06b6d4'}
                        />
                        {isChallenge && idx === 0 && room.players.length > 1 && (
                            <div className="lb-vs-pill">VS</div>
                        )}
                    </React.Fragment>
                ))}
                {isChallenge && room.players.length === 1 && (
                    <div className="lb-waiting-slot">
                        <span className="lb-ws-dot" /><span className="lb-ws-dot" /><span className="lb-ws-dot" />
                        <span>Waiting for opponent</span>
                    </div>
                )}
            </div>

            {/* Result banner */}
            {room.allFinished && room.players.length > 0 && (
                <ResultBanner players={room.players} myUserId={myUserId} />
            )}
        </motion.div>
    );
};

// ─── Live Player Bar ──────────────────────────────────────────────────────────

const LivePlayerBar: React.FC<{
    player: PlayerSnap;
    isMe: boolean;
    color: string;
}> = ({ player, isMe, color }) => (
    <div className={`lb-player-bar ${player.finished ? 'done' : ''} ${isMe ? 'me' : ''}`}>
        <div className="lb-pb-avatar-wrap">
            {player.avatar ? (
                <img src={player.avatar} className="lb-pb-avatar" alt={player.name} />
            ) : (
                <div className="lb-pb-avatar lb-pb-initial" style={{ background: color + '33', color }}>
                    {avatarLetter(player.name)}
                </div>
            )}
            <span className={`lb-online-dot ${player.finished ? 'done' : 'playing'}`} />
        </div>

        <div className="lb-pb-info">
            <div className="lb-pb-top">
                <span className="lb-pb-name">
                    {player.name}
                    {isMe && <span className="lb-pb-you"> (you)</span>}
                </span>
                <span className="lb-pb-status">
                    {player.finished
                        ? <span style={{ color: '#fcd34d' }}>✅ {player.score?.toLocaleString() ?? '—'} pts</span>
                        : <span style={{ color: '#86efac' }}>🎮 {player.progress}%</span>
                    }
                </span>
            </div>
            <div className="lb-pb-track">
                <motion.div
                    className="lb-pb-fill"
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${player.progress}%` }}
                    transition={{ type: 'spring', stiffness: 50, damping: 15 }}
                />
            </div>
            <div className="lb-pb-stats">
                <span>⏱ {fmtTime(player.timeTaken)}</span>
                <span>💡 {player.hintsUsed}</span>
                {player.finished && player.score !== null && (
                    <span style={{ color: '#fcd34d', fontWeight: 700 }}>🏆 {player.score.toLocaleString()}</span>
                )}
            </div>
        </div>
    </div>
);

// ─── Result Banner ────────────────────────────────────────────────────────────

const ResultBanner: React.FC<{ players: PlayerSnap[]; myUserId?: string }> = ({ players, myUserId }) => {
    const sorted = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const winner = sorted[0];
    const didIWin = winner?.userId === myUserId;
    const isTie = sorted.length > 1 && sorted[0].score === sorted[1].score;

    return (
        <div className={`lb-result-banner ${didIWin ? 'winner' : ''} ${isTie ? 'tie' : ''}`}>
            <span className="lb-rb-icon">{isTie ? '🤝' : didIWin ? '🏆' : sorted.length > 1 ? '🎉' : '✅'}</span>
            <span className="lb-rb-text">
                {isTie
                    ? "It's a tie!"
                    : `${winner.name} won with ${winner.score?.toLocaleString() ?? 0} pts`}
            </span>
            {sorted.length > 1 && !isTie && (
                <span className="lb-rb-gap">
                    +{((sorted[0].score ?? 0) - (sorted[1].score ?? 0)).toLocaleString()} pts ahead
                </span>
            )}
        </div>
    );
};

// ─── Demo rooms (shown when no real sessions are live) ────────────────────────

const DEMO_ROOMS: RoomSnapshot[] = [
    {
        id: 'DEMO1', puzzleType: 'matrix', difficulty: 2, mode: 'challenge',
        startedAt: Date.now() - 95000, allFinished: false,
        players: [
            { socketId: 's1', userId: 'demo1', name: 'NeuralNinja', avatar: null, progress: 72, hintsUsed: 0, timeTaken: 95, score: null, finished: false },
            { socketId: 's2', userId: 'demo2', name: 'LogicLord', avatar: null, progress: 58, hintsUsed: 1, timeTaken: 95, score: null, finished: false },
        ],
    },
    {
        id: 'DEMO2', puzzleType: 'binary', difficulty: 1, mode: 'solo',
        startedAt: Date.now() - 45000, allFinished: false,
        players: [
            { socketId: 's3', userId: 'demo3', name: 'PuzzlePro', avatar: null, progress: 45, hintsUsed: 2, timeTaken: 45, score: null, finished: false },
        ],
    },
    {
        id: 'DEMO3', puzzleType: 'deduction', difficulty: 3, mode: 'challenge',
        startedAt: Date.now() - 200000, allFinished: true,
        players: [
            { socketId: 's4', userId: 'demo4', name: 'ThinkFast', avatar: null, progress: 100, hintsUsed: 0, timeTaken: 187, score: 945, finished: true },
            { socketId: 's5', userId: 'demo5', name: 'MindMaze', avatar: null, progress: 100, hintsUsed: 1, timeTaken: 203, score: 910, finished: true },
        ],
    },
];

const DemoRooms: React.FC = () => (
    <div className="lb-demo-rooms">
        <div className="lb-demo-label">📺 Preview — Demo Sessions</div>
        {DEMO_ROOMS.map((room, i) => (
            <LiveRoomCard key={room.id} room={room} highlighted={false} delay={i * 0.1} />
        ))}
    </div>
);

export default LeaderboardPage;
