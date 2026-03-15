import React, { useState, useEffect, useRef } from 'react';
import './PuzzleTimer.css';

interface Props {
    active: boolean;
    onTick: (seconds: number) => void;
    initialValue?: number;
}

const PuzzleTimer: React.FC<Props> = ({ active, onTick, initialValue = 0 }) => {
    const [display, setDisplay] = useState(initialValue);
    const seconds = useRef(initialValue);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Sync display when initialValue changes (e.g. already-solved puzzle)
    useEffect(() => {
        seconds.current = initialValue;
        setDisplay(initialValue);
    }, [initialValue]);

    useEffect(() => {
        if (active) {
            intervalRef.current = setInterval(() => {
                seconds.current++;
                setDisplay(seconds.current);
                onTick(seconds.current);
            }, 1000);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [active, onTick]);

    const m = Math.floor(display / 60).toString().padStart(2, '0');
    const s = (display % 60).toString().padStart(2, '0');

    return (
        <div className={`puzzle-timer ${active ? 'timer-active' : 'timer-stopped'}`}>
            <span className="timer-icon">⏱</span>
            <span className="timer-display">{m}:{s}</span>
        </div>
    );
};

export default PuzzleTimer;
