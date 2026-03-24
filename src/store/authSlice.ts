import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { auth, setToken, getToken, UserProfile } from '../lib/apiClient';

// ─── State ────────────────────────────────────────────────────────────────────

interface AuthState {
    user: UserProfile | null;
    token: string | null;
    isLoading: boolean;
    error: string | null;
    isGuest: boolean;
}

const initialState: AuthState = {
    user: null,
    token: getToken(),
    isLoading: false,
    error: null,
    isGuest: false,
};

// ─── Async Thunks ─────────────────────────────────────────────────────────────

// Helper to safely extract error message from any thrown value
function extractErrorMessage(err: any): string {
    if (typeof err === 'string') return err;
    if (err?.message) return err.message;
    return 'An unexpected error occurred.';
}

export const loginWithGoogle = createAsyncThunk(
    'auth/loginWithGoogle',
    async (idToken: string, { rejectWithValue }) => {
        try {
            const res = await auth.loginWithGoogle(idToken);
            setToken(res.token);
            return res;
        } catch (err: any) {
            return rejectWithValue(extractErrorMessage(err));
        }
    }
);

export const loginAsGuest = createAsyncThunk(
    'auth/loginAsGuest',
    async (_, { rejectWithValue }) => {
        try {
            const res = await auth.loginAsGuest();
            setToken(res.token);
            return res;
        } catch (err: any) {
            // Network offline or server unavailable — create a fully local guest session
            const guestId = localStorage.getItem('ll_guest_id') || `guest_${Date.now()}`;
            const guestName = localStorage.getItem('ll_guest_name') || `Player_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
            localStorage.setItem('ll_guest_id', guestId);
            localStorage.setItem('ll_guest_name', guestName);
            const localToken = `local_guest_${guestId}`;
            setToken(localToken);
            return {
                token: localToken,
                user: {
                    id: guestId,
                    email: null,
                    name: guestName,
                    avatar: null,
                    isGuest: true,
                    streakCount: 0,
                    totalPoints: 0,
                },
            };
        }
    }
);

export const fetchCurrentUser = createAsyncThunk(
    'auth/fetchCurrentUser',
    async (_, { rejectWithValue }) => {
        try {
            return await auth.me();
        } catch (err: any) {
            return rejectWithValue(extractErrorMessage(err));
        }
    }
);

export const loginWithEmail = createAsyncThunk(
    'auth/loginWithEmail',
    async ({ email, password }: { email: string, password: string }, { rejectWithValue }) => {
        try {
            const res = await auth.login(email, password);
            setToken(res.token);
            return res;
        } catch (err: any) {
            return rejectWithValue(extractErrorMessage(err));
        }
    }
);

export const registerWithEmail = createAsyncThunk(
    'auth/registerWithEmail',
    async ({ email, password, name }: { email: string, password: string, name: string }, { rejectWithValue }) => {
        try {
            const res = await auth.register(email, password, name);
            // Do NOT set token — force the user to manually sign in after registration
            return res;
        } catch (err: any) {
            return rejectWithValue(extractErrorMessage(err));
        }
    }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        logout(state) {
            state.user = null;
            state.token = null;
            state.isGuest = false;
            setToken(null);
            // Clear all local session data
            localStorage.removeItem('ll_guest_id');
            localStorage.removeItem('ll_guest_name');
            localStorage.removeItem('ll_tc_id');
            localStorage.removeItem('ll_tc_name');
            localStorage.removeItem('ll_tc_phone');
        },
        clearError(state) {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        // Google
        builder
            .addCase(loginWithGoogle.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(loginWithGoogle.fulfilled, (state, action) => {
                state.isLoading = false;
                state.user = action.payload.user;
                state.token = action.payload.token;
                state.isGuest = false;
            })
            .addCase(loginWithGoogle.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            });

        // Guest
        builder
            .addCase(loginAsGuest.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(loginAsGuest.fulfilled, (state, action) => {
                state.isLoading = false;
                state.user = action.payload.user;
                state.token = action.payload.token;
                state.isGuest = true;
            })
            .addCase(loginAsGuest.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            });

        // Email Login
        builder
            .addCase(loginWithEmail.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(loginWithEmail.fulfilled, (state, action) => {
                state.isLoading = false;
                state.user = action.payload.user;
                state.token = action.payload.token;
                state.isGuest = false;
            })
            .addCase(loginWithEmail.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            });

        // Email Register
        builder
            .addCase(registerWithEmail.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(registerWithEmail.fulfilled, (state, action) => {
                state.isLoading = false;
                // Intentionally keeping state.user and state.token untouched 
                // to force manual sign-in on the frontend!
            })
            .addCase(registerWithEmail.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string;
            });

        // Fetch current user
        builder
            .addCase(fetchCurrentUser.fulfilled, (state, action) => {
                state.user = action.payload;
                state.isGuest = !!(action.payload as any).isGuest;
            })
            .addCase(fetchCurrentUser.rejected, (state) => {
                // Stored token is invalid/expired — clear everything so login page shows
                state.user = null;
                state.token = null;
                state.isGuest = false;
                setToken(null);
            });
    },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
