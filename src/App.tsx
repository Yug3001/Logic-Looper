import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from './store/store';
import { setTab } from './store/gameSlice';
import { fetchCurrentUser } from './store/authSlice';
import { getToken } from './lib/apiClient';
import AnalyticsDashboard from './components/analytics/AnalyticsDashboard';
import GameView from './components/game/GameView';
import PracticeView from './components/game/PracticeView';
import LoginPage from './components/auth/LoginPage';
import LeaderboardPage from './components/social/LeaderboardPage';
import AchievementsPage from './components/social/AchievementsPage';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import './App.css';

const MOBILE_BREAKPOINT = 768;

const App: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const currentTab = useSelector((s: RootState) => s.game.currentTab);
    const { user, token } = useSelector((s: RootState) => s.auth);

    // Start closed on mobile, open on desktop
    const [sidebarOpen, setSidebarOpen] = useState(
        () => typeof window !== 'undefined' && window.innerWidth >= MOBILE_BREAKPOINT
    );
    const [isMobile, setIsMobile] = useState(
        () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
    );

    const [authChecked, setAuthChecked] = useState(false);

    // Track mobile breakpoint
    useEffect(() => {
        const onResize = () => {
            const mobile = window.innerWidth < MOBILE_BREAKPOINT;
            setIsMobile(mobile);
            if (!mobile && !sidebarOpen) setSidebarOpen(true);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [sidebarOpen]);

    const isLoggedIn = Boolean(user || token);

    useEffect(() => {
        const storedToken = getToken();
        if (storedToken) {
            if (storedToken.startsWith('local_guest_')) {
                const guestId = localStorage.getItem('ll_guest_id') || 'guest';
                const guestName = localStorage.getItem('ll_guest_name') || 'Guest';
                dispatch({
                    type: 'auth/loginAsGuest/fulfilled',
                    payload: {
                        token: storedToken,
                        user: {
                            id: guestId, email: null, name: guestName,
                            avatar: null, isGuest: true, streakCount: 0, totalPoints: 0,
                        },
                    },
                });
                setAuthChecked(true);
            } else if (storedToken.startsWith('truecaller_')) {
                const tcId = localStorage.getItem('ll_tc_id') || storedToken;
                const tcName = localStorage.getItem('ll_tc_name') || 'Truecaller User';
                const tcPhone = localStorage.getItem('ll_tc_phone') || '';
                dispatch({
                    type: 'auth/loginWithGoogle/fulfilled',
                    payload: {
                        token: storedToken,
                        user: {
                            id: tcId, email: null, name: tcName,
                            avatar: null, phone: tcPhone,
                            isGuest: false, streakCount: 0, totalPoints: 0,
                        },
                    },
                });
                setAuthChecked(true);
            } else {
                dispatch(fetchCurrentUser()).finally(() => { setAuthChecked(true); });
            }
        } else {
            setAuthChecked(true);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('puzzle')) dispatch(setTab('game'));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleTabChange = useCallback((tab: string) => {
        dispatch(setTab(tab as any));
        // Auto-close sidebar on mobile after navigation
        if (isMobile) setSidebarOpen(false);
    }, [dispatch, isMobile]);

    const handleMenuToggle = useCallback(() => {
        setSidebarOpen(v => !v);
    }, []);

    if (!authChecked) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100vh', background: 'var(--bg-primary)',
                flexDirection: 'column', gap: '16px',
                color: 'var(--text-secondary)', fontFamily: 'var(--font-body)',
            }}>
                <div style={{ fontSize: 40, animation: 'spin 1.2s linear infinite', display: 'inline-block' }}>🧩</div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Logic Looper</p>
                <p style={{ margin: 0, fontSize: 13, opacity: 0.6 }}>Loading your session…</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!isLoggedIn) return <LoginPage />;

    return (
        <div className="app-shell">
            {/* Mobile overlay */}
            {isMobile && sidebarOpen && (
                <div
                    className="sidebar-overlay visible"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <Sidebar
                currentTab={currentTab}
                onTabChange={handleTabChange}
                isOpen={sidebarOpen}
                onToggle={handleMenuToggle}
            />
            <div className={`main-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
                <Topbar onMenuToggle={handleMenuToggle} />
                <div className="page-content">
                    {currentTab === 'game'         && <GameView />}
                    {currentTab === 'practice'     && <PracticeView />}
                    {currentTab === 'analytics'    && <AnalyticsDashboard />}
                    {currentTab === 'leaderboard'  && <LeaderboardPage />}
                    {currentTab === 'achievements' && <AchievementsPage />}
                </div>
            </div>
        </div>
    );
};

export default App;
