import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import dayjs from 'dayjs';

export interface GameState {
    currentTab: 'game' | 'practice' | 'analytics' | 'leaderboard' | 'achievements';
    todayCompleted: boolean;
    todayScore: number;
    hintsRemaining: number;
    dailyPuzzleUnlocked: boolean;
}

const initialState: GameState = {
    currentTab: 'game',
    todayCompleted: false,
    todayScore: 0,
    hintsRemaining: 3,
    dailyPuzzleUnlocked: true,
};

const gameSlice = createSlice({
    name: 'game',
    initialState,
    reducers: {
        setTab(state, action: PayloadAction<GameState['currentTab']>) {
            state.currentTab = action.payload;
        },
        completeTodayPuzzle(state, action: PayloadAction<number>) {
            state.todayCompleted = true;
            state.todayScore = action.payload;
        },
        useHint(state) {
            if (state.hintsRemaining > 0) state.hintsRemaining--;
        },
    },
});

export const { setTab, completeTodayPuzzle, useHint } = gameSlice.actions;
export default gameSlice.reducer;
