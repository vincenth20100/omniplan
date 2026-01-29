'use client';

import type { DurationUnit } from './types';

export interface ParsedDuration {
    value: number;
    unit: DurationUnit;
}

export function parseDuration(input: string, defaultUnit: DurationUnit = 'd'): ParsedDuration | null {
    if (!input) return null;
    const trimmed = input.trim().toLowerCase();
    const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/);

    if (!match) return null;

    const value = parseFloat(match[1]);
    let unitStr = match[2] || defaultUnit; 

    let unit: DurationUnit;
    switch (unitStr) {
        case 'm':
        case 'mo':
        case 'month':
        case 'months':
            unit = 'm';
            break;
        case 'em':
        case 'emo':
        case 'emonth':
        case 'emonths':
            unit = 'em';
            break;
        case 'ed':
        case 'eday':
        case 'edays':
            unit = 'ed';
            break;
        case 'd':
        case 'day':
        case 'days':
        default:
            unit = 'd';
            break;
    }

    return { value, unit };
}

export function formatDuration(duration: number, unit: DurationUnit | undefined): string {
    return `${duration}${unit || 'd'}`;
}
