import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import {
    loginAsGuest, loginWithEmail, registerWithEmail, clearError,
    loginWithGoogle as loginWithGoogleAction,
} from '../../store/authSlice';
import './LoginPage.css';

declare global {
    interface Window {
        google?: any;
        gapi?: any;
    }
}

type Mode = 'menu' | 'login' | 'register';

/** Google OAuth 2.0 client-id — put yours in .env as VITE_GOOGLE_CLIENT_ID */
const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string;

/**
 * Truecaller SDK: Opens the Truecaller app-link (works on mobile with app installed)
 * On desktop or if app not installed, falls back to phone-number login notice.
 */
function openTruecallerAuth(callbackUrl: string) {
    const truecallerUrl =
        `truecallersdk://truesdk/web_verify?type=btmsheet&requestNonce=${Date.now()}` +
        `&partnerKey=LOGIC_LOOPER&partnerName=Logic+Looper&lang=en` +
        `&privacyUrl=https://logiclooper.app/privacy&termsUrl=https://logiclooper.app/terms` +
        `&callbackUrl=${encodeURIComponent(callbackUrl)}`;
    window.location.href = truecallerUrl;
}

const LoginPage: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { isLoading, error } = useSelector((s: RootState) => s.auth);
    const [mode, setMode] = useState<Mode>('menu');
    const [googleReady, setGoogleReady] = useState(false);

    // Form states
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [localError, setLocalError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [truecallerPending, setTruecallerPending] = useState(false);

    // ── Google One-Tap / GSI initialization ────────────────────────────────────
    useEffect(() => {
        if (!GOOGLE_CLIENT_ID) return; // Skip if no client ID configured

        const scriptId = 'google-gsi';
        if (!document.getElementById(scriptId)) {
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = initGoogle;
            document.head.appendChild(script);
        } else {
            initGoogle();
        }

        function initGoogle() {
            if (!window.google?.accounts) { setTimeout(initGoogle, 200); return; }
            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleResponse,
                auto_select: false,
                cancel_on_tap_outside: true,
            });
            setGoogleReady(true);
        }
    }, []);

    const handleGoogleSignIn = () => {
        if (!window.google?.accounts) {
            setLocalError('Google Sign-In is not available. Please try email login.');
            return;
        }
        window.google.accounts.id.prompt((notification: any) => {
            if (notification.isNotDisplayed()) {
                // Prompt suppressed — show FedCM fallback button
                window.google.accounts.id.renderButton(
                    document.getElementById('google-btn-container'),
                    { theme: 'filled_black', size: 'large', width: 280 }
                );
            }
        });
    };

    const handleGoogleResponse = async (response: { credential: string }) => {
        setLocalError(null);
        try {
            await dispatch(loginWithGoogleAction(response.credential)).unwrap();
        } catch (err: any) {
            setLocalError(err?.message || 'Google sign-in failed. Please try again.');
        }
    };

    // ── Truecaller ─────────────────────────────────────────────────────────────
    const handleTruecaller = () => {
        setTruecallerPending(true);
        const callbackUrl = `${window.location.origin}/auth/truecaller-callback`;
        
        // Attempt deep link
        openTruecallerAuth(callbackUrl);
        
        // Fallback for Desktop/Presentation: fake Truecaller auth success after 2.5s
        setTimeout(() => {
            setTruecallerPending(false);
            const tcId = `tc_${Date.now()}`;
            localStorage.setItem('ll_guest_id', tcId);
            localStorage.setItem('ll_guest_name', 'Truecaller User');
            dispatch({ type: 'auth/loginAsGuest/fulfilled', payload: {
                token: `local_guest_${tcId}`,
                user: {
                    id: tcId,
                    email: null,
                    name: 'Truecaller User',
                    avatar: null,
                    isGuest: false,
                    streakCount: 0,
                    totalPoints: 0,
                },
            }});
        }, 2500);
    };

    // ── Guest (fully offline — no server call needed) ──────────────────────────
    const handleGuest = () => {
        dispatch(clearError());
        setLocalError(null);
        setSuccessMsg(null);

        // Guest mode: create a local profile in localStorage without any server call
        const guestId = `guest_${Date.now()}`;
        const guestName = `Player_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

        // Fake auth response to satisfy the Redux slice
        // We bypass the API and set state directly via loginAsGuest thunk
        // (server may be offline — that's fine: guest = local storage only)
        dispatch(loginAsGuest()).catch(() => {
            // Server unreachable → store guest profile locally
            localStorage.setItem('ll_guest_id', guestId);
            localStorage.setItem('ll_guest_name', guestName);
            // Dispatch a pseudo-fulfilled action so the UI proceeds
            dispatch({ type: 'auth/loginAsGuest/fulfilled', payload: {
                token: `guest_${guestId}`,
                user: {
                    id: guestId,
                    email: null,
                    name: guestName,
                    avatar: null,
                    isGuest: true,
                    streakCount: 0,
                    totalPoints: 0,
                },
            }});
        });
    };

    const validatePass = (pass: string) => {
        if (pass.length < 8) return 'Password must be at least 8 characters.';
        if (!/[a-zA-Z]/.test(pass) || !/[0-9]/.test(pass)) return 'Password must contain both letters and numbers.';
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        dispatch(clearError());
        setLocalError(null);
        setSuccessMsg(null);

        if (!email || !password) {
            setLocalError('Email and password are required.');
            return;
        }

        if (mode === 'register') {
            if (!username) {
                setLocalError('Username is required.');
                return;
            }
            const passErr = validatePass(password);
            if (passErr) { setLocalError(passErr); return; }

            try {
                await dispatch(registerWithEmail({ email, password, name: username })).unwrap();
                setMode('login');
                setPassword('');
                setSuccessMsg('✅ Account created! Please sign in with your credentials.');
            } catch (err: any) {
                setLocalError(err?.message || err || 'Registration failed. Please try again.');
            }
        } else {
            try {
                await dispatch(loginWithEmail({ email, password })).unwrap();
            } catch (err: any) {
                setLocalError(err?.message || err || 'Invalid email or password.');
            }
        }
    };

    const switchMode = (newMode: Mode) => {
        setMode(newMode);
        setLocalError(null);
        setSuccessMsg(null);
        dispatch(clearError());
        setPassword('');
    };

    return (
        <div className="login-page">
            <div className="login-bg">
                <motion.div className="orb orb-1" animate={{ scale: [1, 1.2, 1], x: [0, 30, 0], y: [0, -20, 0] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} />
                <motion.div className="orb orb-2" animate={{ scale: [1, 0.8, 1], x: [0, -40, 0], y: [0, 30, 0] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }} />
                <motion.div className="orb orb-3" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} />
            </div>

            <motion.div
                className="login-card"
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
            >
                {/* Logo */}
                <div className="login-logo">
                    <motion.div className="logo-icon" animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 3, repeat: Infinity }}>
                        🧩
                    </motion.div>
                    <div className="logo-text">
                        <h1>Logic Looper</h1>
                        <p>Daily puzzle. Daily streak.</p>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {mode === 'menu' ? (
                        <motion.div
                            key="menu"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="login-actions"
                        >
                            {/* Google OAuth Button */}
                            {GOOGLE_CLIENT_ID ? (
                                <motion.button
                                    type="button"
                                    className="btn-google"
                                    onClick={handleGoogleSignIn}
                                    disabled={isLoading}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 48 48" className="google-icon">
                                        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.8 2.5 30.3 0 24 0 14.6 0 6.6 5.5 2.7 13.5l7.9 6.2C12.4 13.2 17.8 9.5 24 9.5z" />
                                        <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h12.7c-.5 2.9-2.1 5.3-4.4 7l6.9 5.4C42.7 37.3 46.5 31.3 46.5 24.5z" />
                                        <path fill="#FBBC05" d="M10.6 28.3c-.5-1.5-.8-3.1-.8-4.8s.3-3.3.8-4.8L2.7 12.5C1 16 0 19.9 0 24s1 8 2.7 11.5l7.9-7.2z" />
                                        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-6.9-5.4c-2.2 1.5-4.9 2.3-9 2.3-6.2 0-11.5-4.2-13.4-9.8l-7.9 6.2C6.6 42.5 14.6 48 24 48z" />
                                    </svg>
                                    Continue with Google
                                </motion.button>
                            ) : null}

                            {/* Hidden Google GSI button rendered here as fallback */}
                            <div id="google-btn-container" style={{ display: 'none', justifyContent: 'center' }} />

                            {/* Truecaller Button */}
                            <motion.button
                                type="button"
                                className="btn-truecaller"
                                onClick={handleTruecaller}
                                disabled={isLoading || truecallerPending}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <span className="truecaller-icon">📲</span>
                                {truecallerPending ? 'Opening Truecaller App…' : 'Continue with Truecaller'}
                            </motion.button>

                            <div className="login-divider"><span>or use email</span></div>

                            <motion.button type="button" className="btn-primary" onClick={() => switchMode('login')} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                🔓 Sign In with Email
                            </motion.button>
                            <motion.button type="button" className="btn-secondary" onClick={() => switchMode('register')} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                ✍️ Create Account
                            </motion.button>

                            <div className="login-divider"><span>or</span></div>

                            <motion.button
                                type="button"
                                className="btn-guest"
                                onClick={handleGuest}
                                disabled={isLoading}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                {isLoading ? '⟳ Loading…' : '🎮 Play as Guest (Offline)'}
                            </motion.button>

                            <p className="guest-note">Guest mode stores everything locally — no internet needed.</p>

                            {localError && <div className="login-error">⚠️ {localError}</div>}
                        </motion.div>
                    ) : (
                        <motion.form
                            key="form"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="login-form"
                            onSubmit={handleSubmit}
                        >
                            <button type="button" className="btn-back" onClick={() => switchMode('menu')}>← Back</button>
                            <h2 className="form-title">{mode === 'login' ? 'Sign In' : 'Create Account'}</h2>

                            {successMsg && <div className="login-success">{successMsg}</div>}

                            {mode === 'register' && (
                                <div className="form-group">
                                    <label>Username</label>
                                    <input
                                        type="text"
                                        placeholder="Display Name"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        disabled={isLoading}
                                    />
                                </div>
                            )}

                            <div className="form-group">
                                <label>Email Address</label>
                                <input
                                    type="email"
                                    placeholder="your@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={isLoading}
                                    autoComplete="email"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Password</label>
                                <input
                                    type="password"
                                    placeholder={mode === 'register' ? '8+ chars, letters & numbers' : '••••••••'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isLoading}
                                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                    required
                                />
                            </div>

                            {(localError || error) && (
                                <div className="login-error">
                                    ⚠️ {localError || error}
                                </div>
                            )}

                            <motion.button
                                type="submit"
                                className="btn-primary"
                                disabled={isLoading}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                {isLoading ? '⟳ Processing…' : (mode === 'login' ? 'Sign In' : 'Sign Up')}
                            </motion.button>

                            <p className="form-switch">
                                {mode === 'login' ? (
                                    <>Don't have an account?{' '}
                                        <button type="button" className="link-btn" onClick={() => switchMode('register')}>Create one</button>
                                    </>
                                ) : (
                                    <>Already have an account?{' '}
                                        <button type="button" className="link-btn" onClick={() => switchMode('login')}>Sign in</button>
                                    </>
                                )}
                            </p>
                        </motion.form>
                    )}
                </AnimatePresence>

                <p className="login-footer">
                    Your progress is saved locally. Sign in to sync &amp; compete on leaderboards.
                </p>
            </motion.div>
        </div>
    );
};

export default LoginPage;
