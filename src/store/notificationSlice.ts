import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Notification {
    id: string;
    type: 'challenge' | 'achievement' | 'streak' | 'system';
    title: string;
    message: string;
    timestamp: string;   // ISO string
    read: boolean;
    meta?: Record<string, unknown>;
}

interface NotificationState {
    items: Notification[];
    panelOpen: boolean;
}

const STORAGE_KEY = 'll_notifications';

function loadFromStorage(): Notification[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveToStorage(items: Notification[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 100))); // keep latest 100
    } catch { /* ignore quota errors */ }
}

const initialState: NotificationState = {
    items: loadFromStorage(),
    panelOpen: false,
};

const notificationSlice = createSlice({
    name: 'notifications',
    initialState,
    reducers: {
        pushNotification(state, action: PayloadAction<Omit<Notification, 'id' | 'read' | 'timestamp'>>) {
            const notif: Notification = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                read: false,
                timestamp: new Date().toISOString(),
                ...action.payload,
            };
            state.items.unshift(notif);
            saveToStorage(state.items);
        },
        markRead(state, action: PayloadAction<string>) {
            const n = state.items.find(i => i.id === action.payload);
            if (n) { n.read = true; saveToStorage(state.items); }
        },
        markAllRead(state) {
            state.items.forEach(n => { n.read = true; });
            saveToStorage(state.items);
        },
        removeNotification(state, action: PayloadAction<string>) {
            state.items = state.items.filter(i => i.id !== action.payload);
            saveToStorage(state.items);
        },
        clearAll(state) {
            state.items = [];
            saveToStorage(state.items);
        },
        togglePanel(state) {
            state.panelOpen = !state.panelOpen;
        },
        closePanel(state) {
            state.panelOpen = false;
        },
    },
});

export const {
    pushNotification,
    markRead,
    markAllRead,
    removeNotification,
    clearAll,
    togglePanel,
    closePanel,
} = notificationSlice.actions;

export default notificationSlice.reducer;
