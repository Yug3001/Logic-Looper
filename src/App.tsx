import React, { useState, useEffect } from 'react';
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

const App: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const currentTab = useSelector((s: RootState) => s.game.currentTab);
    const { user, token } = useSelector((s: RootState) => s.auth);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    // authChecked prevents the app from rendering before we know if the stored token is valid
    const [authChecked, setAuthChecked] = useState(false);

    const isLoggedIn = Boolean(user || token);

    // Validate stored JWT on mount — this prevents bypassing login with stale/invalid token
    // EXCEPT for local guest tokens which are purely client-side (no server to validate against)
    useEffect(() => {
        const storedToken = getToken();
        if (storedToken && !user) {
            if (storedToken.startsWith('local_guest_')) {
                // Offline guest — restore profile from localStorage
                const guestId = localStorage.getItem('ll_guest_id') || 'guest';
                const guestName = localStorage.getItem('ll_guest_name') || 'Guest';
                dispatch({
                    type: 'auth/loginAsGuest/fulfilled',
                    payload: {
                        token: storedToken,
                        user: {
                            id: guestId,
                            email: null,
                            name: guestName,
                            avatar: null,
                            isGuest: true,
                            streakCount: 0,
                            totalPoints: 0,
                        },
                    },
                });
                setAuthChecked(true);
            } else {
                // Server JWT — validate against backend
                dispatch(fetchCurrentUser()).finally(() => {
                    setAuthChecked(true);
                });
            }
        } else {
            setAuthChecked(true);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Handle friend challenge URL params → auto-navigate to Game tab
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('puzzle')) {
            dispatch(setTab('game'));
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleTabChange = (tab: string) => {
        dispatch(setTab(tab as any));
    };

    // Show loading spinner while validating stored token
    if (!authChecked) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                background: 'var(--bg-root, #0d0d1a)',
                flexDirection: 'column',
                gap: '16px',
                color: 'var(--text-secondary, #888)',
                fontFamily: 'inherit',
            }}>
                <div style={{
                    fontSize: 40,
                    animation: 'spin 1.2s linear infinite',
                    display: 'inline-block',
                }}>🧩</div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Logic Looper</p>
                <p style={{ margin: 0, fontSize: 13, opacity: 0.6 }}>Loading your session…</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (!isLoggedIn) {
        return <LoginPage />;
    }

    return (
        <div className="app-shell">
            <Sidebar
                currentTab={currentTab}
                onTabChange={handleTabChange}
                isOpen={sidebarOpen}
                onToggle={() => setSidebarOpen(!sidebarOpen)}
            />
            <div className={`main-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
                <Topbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
                <div className="page-content">
                    {currentTab === 'game' && <GameView />}
                    {currentTab === 'practice' && <PracticeView />}
                    {currentTab === 'analytics' && <AnalyticsDashboard />}
                    {currentTab === 'leaderboard' && <LeaderboardPage />}
                    {currentTab === 'achievements' && <AchievementsPage />}
                </div>
            </div>
        </div>
    );
};

export default App;
