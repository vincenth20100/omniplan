'use client';
import {
    addDays, differenceInDays, format, startOfMonth, endOfMonth,
    eachDayOfInterval, startOfQuarter, endOfQuarter, startOfYear, endOfYear,
    getYear, getMonth, eachWeekOfInterval
} from 'date-fns';
import React from 'react';
import type { GanttSettings } from '@/lib/types';

const getUnits = (
    startDate: Date,
    endDate: Date,
    endOfUnit: (d: Date) => Date,
    formatLabel: (d: Date) => string,
    nextUnitDate: (currentEnd: Date) => Date
) => {
    const units = [];
    let currentDate = startDate;
    while (currentDate <= endDate) {
        const unitEnd = endOfUnit(currentDate);
        const effectiveEndDate = unitEnd > endDate ? endDate : unitEnd;
        const daysInUnit = differenceInDays(effectiveEndDate, currentDate) + 1;

        if (daysInUnit > 0) {
            units.push({
                name: formatLabel(currentDate),
                days: daysInUnit,
                date: currentDate,
                key: currentDate.toISOString()
            });
        }

        currentDate = nextUnitDate(unitEnd);
    }
    return units;
};

const getYears = (startDate: Date, endDate: Date) => {
    return getUnits(
        startDate,
        endDate,
        endOfYear,
        (d) => format(d, 'yyyy'),
        (d) => addDays(d, 1)
    );
};

const getSemesters = (startDate: Date, endDate: Date) => {
    return getUnits(
        startDate,
        endDate,
        (d) => {
             const year = getYear(d);
             const month = getMonth(d);
             if (month < 6) {
                 return new Date(year, 5, 30); // End of June. Safe approximation? June has 30 days.
                 // Better: endOfMonth(new Date(year, 5, 1))
             } else {
                 return new Date(year, 11, 31);
             }
        },
        (d) => {
             const month = getMonth(d);
             return month < 6 ? `H1 ${format(d, 'yy')}` : `H2 ${format(d, 'yy')}`;
        },
        (d) => addDays(d, 1)
    );
};

const getQuarters = (startDate: Date, endDate: Date) => {
    return getUnits(
        startDate,
        endDate,
        endOfQuarter,
        (d) => `Q${Math.floor(getMonth(d) / 3) + 1} ${format(d, 'yyyy')}`,
        (d) => addDays(d, 1)
    );
};

const getMonths = (startDate: Date, endDate: Date) => {
    return getUnits(
        startDate,
        endDate,
        endOfMonth,
        (d) => format(d, 'MMMM yyyy'),
        (d) => addDays(d, 1)
    );
};

const getWeeks = (startDate: Date, endDate: Date) => {
    // Re-implementing with robust logic
    // Week starts on Sunday? date-fns default.
    // If startDate is Tue, first unit is Tue-Sat (or Tue-Sun depending on week start).
    // `endOfWeek` would be useful.
    // But `eachWeekOfInterval` was used before.

    // I'll use simple 7-day logic or align to week boundaries?
    // Gantt charts usually align weeks to specific days (e.g. Mon or Sun).
    // Let's assume ISO week (Mon start) or default (Sun start).
    // The previous implementation used `eachWeekOfInterval`.
    // I'll stick to a simpler "Week N" label, but I need to know boundaries.

    // Let's use `getUnits` with endOfWeek logic.
    // But I need to import `endOfWeek`.
    // Instead I can rely on `format(d, 'w')` changing?

    const units: {name: string, days: number, date: Date, key: string}[] = [];
    let currentDate = startDate;

    while (currentDate <= endDate) {
        // Find end of week.
        // Assuming we want to align to week boundaries.
        // But the first week might be partial.

        // This is tricky without `endOfWeek`.
        // Let's try to infer next week start.
        // `eachWeekOfInterval` returns starts of weeks.

        // Let's revert to a simpler "chunk 7 days" or "align to Sunday".
        // Let's just use `getUnits` but I'll approximate end of week by finding next boundary.
        // Actually, just loop day by day? No, efficient loop needed.

        // Let's assume standard behavior:
        // We want strict alignment.
        // I will use a custom loop.

        const currentWeekStr = format(currentDate, 'w');
        let tempDate = currentDate;
        // Search forward for end of week (change in week number)
        // This is inefficient (O(days)).
        // Better: use date math.
        // day of week: 0 (Sun) - 6 (Sat).
        // days until end of week = 6 - getDay(currentDate). (For Sat end).
        const dayOfWeek = tempDate.getDay();
        const daysRemainingInWeek = 6 - dayOfWeek;

        let unitEnd = addDays(currentDate, daysRemainingInWeek);

        const effectiveEndDate = unitEnd > endDate ? endDate : unitEnd;
        const daysInUnit = differenceInDays(effectiveEndDate, currentDate) + 1;

        units.push({
            name: `W${currentWeekStr}`,
            days: daysInUnit,
            date: currentDate,
            key: currentDate.toISOString()
        });

        currentDate = addDays(unitEnd, 1);
    }
    return units;
};


export const TimelineHeader = React.memo(({ startDate, endDate, scale, viewMode }: { startDate: Date, endDate: Date, scale: number, viewMode: GanttSettings['viewMode'] }) => {

    // Determine Top and Bottom rows based on viewMode
    let TopRowUnits: ReturnType<typeof getUnits> = [];
    let BottomRowUnits: ReturnType<typeof getUnits> | Date[] = [];
    let showDayView = false;

    // Default fallbacks
    const vm = viewMode || (scale > 20 ? 'day' : (scale > 1 ? 'week' : 'month'));

    switch (vm) {
        case 'year':
            TopRowUnits = getYears(startDate, endDate);
            BottomRowUnits = getQuarters(startDate, endDate);
            break;
        case 'semester':
            TopRowUnits = getYears(startDate, endDate);
            BottomRowUnits = getSemesters(startDate, endDate);
            break;
        case 'quarter':
            TopRowUnits = getYears(startDate, endDate);
            BottomRowUnits = getQuarters(startDate, endDate);
            break;
        case 'month':
            TopRowUnits = getYears(startDate, endDate);
            BottomRowUnits = getMonths(startDate, endDate);
            break;
        case 'week':
            TopRowUnits = getMonths(startDate, endDate);
            BottomRowUnits = getWeeks(startDate, endDate);
            break;
        case 'day':
            TopRowUnits = getMonths(startDate, endDate);
            showDayView = true;
            // For Day view, bottom row is just Days. Handled separately in render.
            break;
        default:
             // Fallback to existing logicish
             if (scale > 20) {
                 TopRowUnits = getMonths(startDate, endDate);
                 showDayView = true;
             } else {
                 TopRowUnits = getMonths(startDate, endDate);
                 BottomRowUnits = getWeeks(startDate, endDate);
             }
    }

    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return (
        <div className="sticky top-0 z-50 bg-background">
            {/* Top Row */}
            <div className="relative flex border-b h-12">
                {TopRowUnits.map((unit) => (
                    <div
                        key={unit.key}
                        className="flex items-center justify-center flex-shrink-0 text-center border-r overflow-hidden"
                        style={{ width: unit.days * scale }}
                    >
                        <span className="text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis px-1">
                            {unit.name}
                        </span>
                    </div>
                ))}
            </div>

            {/* Bottom Row */}
            <div className="relative flex h-12 border-b">
                {showDayView ? (
                    days.map((day, index) => (
                        <div
                            key={index}
                            className="flex-shrink-0 flex items-center justify-center border-r overflow-hidden"
                            style={{ width: scale }}
                        >
                            <span className="text-xs">{format(day, 'd')}</span>
                        </div>
                    ))
                ) : (
                    (BottomRowUnits as any[]).map((unit) => (
                        <div
                            key={unit.key}
                            className="flex items-center justify-center flex-shrink-0 text-center border-r overflow-hidden"
                            style={{ width: unit.days * scale }}
                        >
                            <span className="text-xs font-semibold whitespace-nowrap overflow-hidden text-ellipsis px-1">
                                {unit.name}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
});

TimelineHeader.displayName = 'TimelineHeader';
