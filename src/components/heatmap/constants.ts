import { IntensityLevel } from '../../lib/db';

export const INTENSITY_COLORS: Record<IntensityLevel, string> = {
    0: 'var(--hm-0)',
    1: 'var(--hm-1)',
    2: 'var(--hm-2)',
    3: 'var(--hm-3)',
    4: 'var(--hm-4)',
};

export const INTENSITY_LABELS: Record<IntensityLevel, string> = {
    0: 'Not played',
    1: 'Easy solved',
    2: 'Medium solved',
    3: 'Hard solved',
    4: 'Perfect score',
};
