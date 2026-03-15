import { configureStore } from '@reduxjs/toolkit';
import analyticsReducer from './analyticsSlice';
import gameReducer from './gameSlice';
import authReducer from './authSlice';
import notificationReducer from './notificationSlice';

export const store = configureStore({
    reducer: {
        analytics: analyticsReducer,
        game: gameReducer,
        auth: authReducer,
        notifications: notificationReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({ serializableCheck: false }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
