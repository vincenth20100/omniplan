export type UiDensity = 'compact' | 'medium' | 'large';

export const DENSITY_SETTINGS: Record<UiDensity, {
    rowHeight: number;
    barHeight: number;
    summaryBarHeight: number;
}> = {
    large: { rowHeight: 48, barHeight: 28, summaryBarHeight: 28 },
    medium: { rowHeight: 40, barHeight: 24, summaryBarHeight: 24 },
    compact: { rowHeight: 32, barHeight: 20, summaryBarHeight: 20 },
};
