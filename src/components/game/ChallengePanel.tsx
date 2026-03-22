/**
 * ChallengePanel — Real-time head-to-head battle UI
 *
 * Shows both players' live progress, status, timers, and final results.
 * Mounts when a challenge roomId is active.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store/store';
import { pushNotification } from '../../store/notificationSlice';
import {
    getChallengeService,
    destroyChallengeService,
    PlayerSnapshot,
    buildChallengeUrl,
    generateRoomId,
    parseChallengeUrl,
} from '../../lib/challengeService';
import { formatDateLocal } from '../../lib/db';
import './ChallengePanel.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
    puzzleType: string;
    difficulty: number;
    joinCode?: string;          // If provided, auto-join this room on mount
    onChallengeStart: (roomId: string) => void;
    onChallengeEnd: () => void;
    /** Called by parent GameView to report progress */
    onRegisterProgressEmitter: (fn: (progress: number, hintsUsed: number, timeTaken: number) => void) => void;
    /** Called by parent GameView to report completion */
    onRegisterCompleteEmitter: (fn: (score: number, timeTaken: number, hintsUsed: number, correct: boolean) => void) => void;
    /** Called by GameView to register an external join trigger */
    onRegisterJoinTrigger?: (fn: (code: string) => void) => void;
}

type PanelState = 'idle' | 'waiting' | 'active' | 'finished';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const avatarFallback = (name: string) => name?.charAt(0)?.toUpperCase() ?? '?';
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const DIFF_COLOR = ['#10B981', '#F59E0B', '#F97316', '#EF4444'];
const DIFF_LABEL = ['Easy', 'Medium', 'Hard', 'Expert'];

// ─── Component ────────────────────────────────────────────────────────────────

const ChallengePanel: React.FC<Props> = ({
    puzzleType,
    difficulty,
    joinCode,
    onChallengeStart,
    onChallengeEnd,
    onRegisterProgressEmitter,
    onRegisterCompleteEmitter,
    onRegisterJoinTrigger,
}) => {
    const dispatch = useDispatch<AppDispatch>();
    const { user } = useSelector((s: RootState) => s.auth);
    const today = formatDateLocal(new Date());

    const [panelState, setPanelState] = useState<PanelState>('idle');
    const [roomId, setRoomId] = useState<string>('');
    const [shareUrl, setShareUrl] = useState<string>('');
    const [copySuccess, setCopySuccess] = useState(false);
    const [myPlayer, setMyPlayer] = useState<PlayerSnapshot | null>(null);
    const [opponent, setOpponent] = useState<PlayerSnapshot | null>(null);
    const [startedAt, setStartedAt] = useState<number | null>(null);
    const [elapsedSec, setElapsedSec] = useState(0);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [finishResults, setFinishResults] = useState<PlayerSnapshot[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Timer ──────────────────────────────────────────────────────────────────

    const startTimer = useCallback((from: number) => {
        timerRef.current && clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setElapsedSec(Math.floor((Date.now() - from) / 1000));
        }, 1000);
    }, []);

    // ── Cleanup ────────────────────────────────────────────────────────────────

    useEffect(() => {
        return () => {
            timerRef.current && clearInterval(timerRef.current);
            destroyChallengeService();
        };
    }, []);

    // ── Register emitters with parent ─────────────────────────────────────────

    useEffect(() => {
        const svc = getChallengeService();

        onRegisterProgressEmitter((progress, hintsUsed, timeTaken) => {
            if (panelState === 'active') {
                svc.emitProgress({ progress, hintsUsed, timeTaken });
                setMyPlayer(prev => prev ? { ...prev, progress, hintsUsed, timeTaken } : prev);
            }
        });

        onRegisterCompleteEmitter((score, timeTaken, hintsUsed, correct) => {
            if (panelState === 'active') {
                svc.emitComplete({ score, timeTaken, hintsUsed, correct });
                setMyPlayer(prev => prev ? { ...prev, score, timeTaken, hintsUsed, finished: true, progress: 100 } : prev);
            }
        });
    }, [panelState, onRegisterProgressEmitter, onRegisterCompleteEmitter]);

    // ── Join room ──────────────────────────────────────────────────────────────

    const joinRoom = useCallback(async (rid: string) => {
        if (!user) return;
        setErrorMsg(null);

        const svc = getChallengeService();
        const url = buildChallengeUrl(rid, today);
        setRoomId(rid);
        setShareUrl(url);

        try {
            await svc.joinRoom({
                roomId: rid,
                userId: user.id,
                name: user.name ?? 'Player',
                avatar: user.avatar ?? null,
                puzzleDate: today,
                puzzleType,
                difficulty,
            });
            setPanelState('waiting');
            onChallengeStart(rid);

            // Waiting for opponent
            svc.onEvent('challenge:ready', (data) => {
                setMyPlayer(data.player);
            });

            // Both connected — START
            svc.onEvent('challenge:joined', (data) => {
                const me = data.players.find(p => p.userId === user.id) ?? data.players[0];
                const opp = data.players.find(p => p.userId !== user.id) ?? null;
                setMyPlayer(me);
                setOpponent(opp);
                setStartedAt(data.startedAt);
                startTimer(data.startedAt);
                setPanelState('active');
                // Notify — opponent joined the room
                if (opp) {
                    dispatch(pushNotification({
                        type: 'challenge',
                        title: '⚔️ Challenge Started!',
                        message: `${opp.name} accepted your challenge. Battle begins now!`,
                    }));
                }
            });

            // Opponent progress
            svc.onEvent('challenge:progress', (data) => {
                if (data.userId !== user.id) {
                    setOpponent(prev => prev ? {
                        ...prev,
                        progress: data.progress,
                        hintsUsed: data.hintsUsed,
                        timeTaken: data.timeTaken,
                    } : prev);
                }
            });

            // Someone finished
            svc.onEvent('challenge:completed', (data) => {
                setFinishResults(data.players);
                if (data.allFinished) {
                    timerRef.current && clearInterval(timerRef.current);
                    setPanelState('finished');
                    // Notify result
                    const me = data.players.find(p => p.userId === user.id);
                    const opp = data.players.find(p => p.userId !== user.id);
                    const sorted = [...data.players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
                    const didIWin = sorted[0]?.userId === user.id;
                    dispatch(pushNotification({
                        type: 'challenge',
                        title: didIWin ? '🏆 You Won the Challenge!' : '🎮 Challenge Complete',
                        message: `vs ${opp?.name ?? 'opponent'} — Your score: ${me?.score ?? 0} pts`,
                    }));
                } else {
                    // Update the finisher's state
                    if (data.finisher.userId !== user.id) {
                        setOpponent(data.finisher);
                    }
                }
            });

            // Opponent left
            svc.onEvent('challenge:opponent_left', () => {
                setOpponent(null);
                setErrorMsg('Opponent disconnected.');
                if (panelState !== 'finished') setPanelState('waiting');
            });

            // Error
            svc.onEvent('challenge:error', (data) => {
                setErrorMsg(data.message);
                setPanelState('idle');
            });

        } catch (err: any) {
            setErrorMsg(err.message ?? 'Failed to connect');
            setPanelState('idle');
        }
    }, [user, today, puzzleType, difficulty, onChallengeStart, startTimer, panelState]);

    // ── Auto-join from joinCode prop (set by modal) ──────────────────────────
    useEffect(() => {
        if (joinCode && user && panelState === 'idle') {
            joinRoom(joinCode);
        }
    }, [joinCode, user]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Register external join trigger for GameView → modal ──────────────────
    useEffect(() => {
        if (onRegisterJoinTrigger) {
            onRegisterJoinTrigger((code: string) => {
                joinRoom(code);
            });
        }
    }, [onRegisterJoinTrigger, joinRoom]);

    // ── Auto-join from URL ─────────────────────────────────────────────────────

    useEffect(() => {
        const parsed = parseChallengeUrl();
        if (parsed && user && panelState === 'idle' && !joinCode) {
            joinRoom(parsed.roomId);
        }
    }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Create new challenge ───────────────────────────────────────────────────

    const handleCreate = useCallback(() => {
        const rid = generateRoomId();
        joinRoom(rid);
    }, [joinRoom]);

    // ── Exit challenge ─────────────────────────────────────────────────────────

    const handleExit = useCallback(() => {
        timerRef.current && clearInterval(timerRef.current);
        destroyChallengeService();
        setPanelState('idle');
        setRoomId('');
        setMyPlayer(null);
        setOpponent(null);
        setFinishResults([]);
        setErrorMsg(null);
        onChallengeEnd();
        // Remove challenge params from URL
        const url = new URL(window.location.href);
        url.searchParams.delete('challenge');
        url.searchParams.delete('date');
        window.history.replaceState({}, '', url.toString());
    }, [onChallengeEnd]);

    // ── Copy link ──────────────────────────────────────────────────────────────

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(shareUrl).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        });
    }, [shareUrl]);

    // ─── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="challenge-panel">
            {/* ── IDLE: Create challenge button ── */}
            {panelState === 'idle' && (
                <motion.div
                    className="cp-idle"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="cp-idle-icon">⚔️</div>
                    <h3>Challenge a Friend</h3>
                    <p>Race on the same puzzle in real-time and see who's faster!</p>
                    <motion.button
                        className="cp-btn-create"
                        onClick={handleCreate}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                    >
                        🚀 Create Challenge
                    </motion.button>
                    {errorMsg && <div className="cp-error">⚠️ {errorMsg}</div>}
                </motion.div>
            )}

            {/* ── WAITING: Show 5-letter code + share link ── */}
            {panelState === 'waiting' && (
                <motion.div
                    className="cp-waiting"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    <div className="cp-waiting-pulse">
                        <span className="cp-pulse-dot" />
                        <span className="cp-pulse-dot" />
                        <span className="cp-pulse-dot" />
                    </div>
                    <h3>Waiting for Opponent…</h3>

                    {/* Big code display */}
                    <div style={{
                        background: 'rgba(139,92,246,0.08)',
                        border: '1px solid rgba(139,92,246,0.25)',
                        borderRadius: 'var(--radius-xl)',
                        padding: '16px 20px',
                        textAlign: 'center',
                    }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                            Room Code — Share with your friend
                        </div>
                        <div style={{
                            fontSize: '2.8rem',
                            fontWeight: 900,
                            fontFamily: 'var(--font-mono)',
                            letterSpacing: '0.35em',
                            background: 'var(--gradient-hero)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}>
                            {roomId}
                        </div>
                    </div>

                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>or share the link:</p>
                    <div className="cp-share-box">
                        <input
                            className="cp-share-input"
                            readOnly
                            value={shareUrl}
                            onClick={e => (e.target as HTMLInputElement).select()}
                        />
                        <motion.button
                            className={`cp-copy-btn ${copySuccess ? 'copied' : ''}`}
                            onClick={handleCopy}
                            whileTap={{ scale: 0.92 }}
                        >
                            {copySuccess ? '✓ Copied!' : '📋 Copy'}
                        </motion.button>
                    </div>
                    <button className="cp-exit-btn" onClick={handleExit}>Cancel</button>
                </motion.div>
            )}

            {/* ── ACTIVE: Live battle ── */}
            {(panelState === 'active' || panelState === 'finished') && (
                <motion.div
                    className="cp-battle"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    {/* Header */}
                    <div className="cp-battle-header">
                        <div className="cp-battle-title">
                            <span className="cp-vs-icon">⚔️</span>
                            <span>Live Challenge</span>
                            <span className="cp-diff-badge" style={{
                                background: DIFF_COLOR[difficulty] + '22',
                                color: DIFF_COLOR[difficulty],
                                border: `1px solid ${DIFF_COLOR[difficulty]}44`,
                            }}>
                                {DIFF_LABEL[difficulty]}
                            </span>
                        </div>
                        {panelState === 'active' && (
                            <div className="cp-live-timer">
                                <span className="cp-live-dot" />
                                {fmtTime(elapsedSec)}
                            </div>
                        )}
                    </div>

                    {/* Players */}
                    <div className="cp-players">
                        <PlayerCard
                            player={myPlayer}
                            label="You"
                            isMe
                        />
                        <div className="cp-vs-divider">VS</div>
                        <PlayerCard
                            player={opponent}
                            label={opponent ? opponent.name : 'Waiting…'}
                            isMe={false}
                        />
                    </div>

                    {/* Finished results */}
                    <AnimatePresence>
                        {panelState === 'finished' && finishResults.length > 0 && (
                            <motion.div
                                className="cp-results"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                <ResultsTable players={finishResults} myUserId={user?.id ?? ''} />
                                <button className="cp-exit-btn" onClick={handleExit}>
                                    🏁 Exit Challenge
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {errorMsg && <div className="cp-error">⚠️ {errorMsg}</div>}
                </motion.div>
            )}
        </div>
    );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const PlayerCard: React.FC<{
    player: PlayerSnapshot | null;
    label: string;
    isMe: boolean;
}> = ({ player, label, isMe }) => {
    if (!player) {
        return (
            <div className={`cp-player-card cp-player-empty ${isMe ? 'me' : 'opp'}`}>
                <div className="cp-avatar-ring">
                    <div className="cp-avatar cp-avatar-ghost">?</div>
                    <span className="cp-online-dot cp-dot-offline" />
                </div>
                <span className="cp-player-name">{label}</span>
                <span className="cp-player-status offline">Offline</span>
            </div>
        );
    }

    return (
        <motion.div
            className={`cp-player-card ${isMe ? 'me' : 'opp'} ${player.finished ? 'finished' : ''}`}
            animate={player.finished ? { boxShadow: ['0 0 0 0 rgba(16,185,129,0)', '0 0 0 8px rgba(16,185,129,0.3)', '0 0 0 0 rgba(16,185,129,0)'] } : {}}
            transition={{ repeat: player.finished ? 0 : Infinity, duration: 1.5 }}
        >
            <div className="cp-avatar-ring">
                {player.avatar ? (
                    <img src={player.avatar} className="cp-avatar" alt={player.name} />
                ) : (
                    <div className="cp-avatar cp-avatar-initial">{avatarFallback(player.name)}</div>
                )}
                <span className={`cp-online-dot ${player.finished ? 'cp-dot-done' : 'cp-dot-online'}`} />
            </div>

            <span className="cp-player-name">
                {player.name}
                {isMe && <span className="cp-you-tag"> (You)</span>}
            </span>

            <span className={`cp-player-status ${player.finished ? 'done' : 'playing'}`}>
                {player.finished ? '✅ Finished!' : '🎮 Playing…'}
            </span>

            {/* Progress bar */}
            <div className="cp-progress-track">
                <motion.div
                    className={`cp-progress-fill ${isMe ? 'fill-me' : 'fill-opp'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${player.progress}%` }}
                    transition={{ type: 'spring', stiffness: 60, damping: 15 }}
                />
                <span className="cp-progress-pct">{player.progress}%</span>
            </div>

            {/* Stats */}
            <div className="cp-player-stats">
                <div className="cp-pstat">
                    <span>⏱</span>
                    <span>{fmtTime(player.timeTaken)}</span>
                </div>
                <div className="cp-pstat">
                    <span>💡</span>
                    <span>{player.hintsUsed} hints</span>
                </div>
                {player.score !== null && (
                    <div className="cp-pstat score">
                        <span>🏆</span>
                        <span>{player.score.toLocaleString()} pts</span>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

const ResultsTable: React.FC<{ players: PlayerSnapshot[]; myUserId: string }> = ({ players, myUserId }) => {
    const sorted = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const winner = sorted[0];
    const didIWin = winner?.userId === myUserId;

    return (
        <div className="cp-results-table">
            <div className="cp-results-title">
                {didIWin ? '🏆 You Won!' : '🎉 Game Over!'}
            </div>
            {sorted.map((p, i) => (
                <div key={p.userId} className={`cp-result-row ${p.userId === myUserId ? 'me' : ''} ${i === 0 ? 'winner' : ''}`}>
                    <span className="cp-rank">{i === 0 ? '🥇' : '🥈'}</span>
                    <span className="cp-name">{p.name}</span>
                    <span className="cp-score">{(p.score ?? 0).toLocaleString()} pts</span>
                    <span className="cp-time">{fmtTime(p.timeTaken)}</span>
                    <span className="cp-hints">💡 {p.hintsUsed}</span>
                </div>
            ))}
        </div>
    );
};

export default ChallengePanel;
