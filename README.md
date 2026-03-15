# Logic Looper — Daily Puzzle Game

A daily logic puzzle game with streak tracking, heatmap analytics, and offline-first architecture.

## Tech Stack
- **React 19** + **TypeScript** (Vite)
- **Redux Toolkit** — client state
- **Framer Motion** — animations  
- **Recharts** — analytics charts
- **IndexedDB (idb)** — offline activity storage
- **dayjs** — date handling
- **Vercel** — deployment

## Local Development

```bash
npm install
npm run dev
# Open http://localhost:5173
```

## Build for Production

```bash
npm run build
# Output → dist/
```

## Deploy to Vercel

### Option 1: Vercel CLI
```bash
npm install -g vercel
vercel --prod
```

### Option 2: GitHub + Vercel Dashboard
1. Push to GitHub: `git push origin main`
2. Import at [vercel.com/new](https://vercel.com/new)
3. Framework: **Vite**
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Click **Deploy**

## Architecture

```
src/
├── lib/
│   ├── db.ts               # IndexedDB engine (offline-first)
│   ├── syncService.ts      # Smart batch sync to server
│   └── achievementEngine.ts # Client-side achievement logic
├── hooks/
│   └── useHeatmap.ts       # Data + streak + grid hook
├── store/
│   ├── analyticsSlice.ts   # Redux analytics state
│   └── gameSlice.ts        # Redux game/nav state
└── components/
    ├── heatmap/            # Heatmap system components
    └── analytics/          # Dashboard components
```

## Features
- 📊 GitHub-style contribution heatmap (365 days)
- 🔥 Streak tracking with milestone celebrations
- 🏆 Global leaderboard (Top 100)
- 🎖️ 12 client-side achievements
- ⚡ Offline-first via IndexedDB
- 📈 Performance analytics (score, time, type breakdown)
- 🎨 4 color themes (Purple/Green/Cyan/Pink)
