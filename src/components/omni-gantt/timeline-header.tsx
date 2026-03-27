'use client';
import {
    addDays, differenceInDays, format, startOfMonth, endOfMonth,
    eachDayOfInterval, startOfQuarter, endOfQuarter, startOfYear, endOfYear,
    getYear, getMonth
} from 'date-fns';
import { fastDifferenceInCalendarDays } from '@/lib/date-utils';
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
                 return new Date(year, 5, 30);
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
    const units: {name: string, days: number, date: Date, key: string}[] = [];
    let currentDate = startDate;

    while (currentDate <= endDate) {
        const currentWeekStr = format(currentDate, 'w');
        const dayOfWeek = currentDate.getDay();
        const daysRemainingInWeek = 6 - dayOfWeek;

        const unitEnd = addDays(currentDate, daysRemainingInWeek);
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


export const TimelineHeader = React.memo(({ startDate, endDate, scale, viewMode, visibleStartX, visibleEndX }: {
    startDate: Date,
    endDate: Date,
    scale: number,
    viewMode: GanttSettings['viewMode'],
    visibleStartX?: number,
    visibleEndX?: number
}) => {

    // Determine Top and Bottom rows based on viewMode
    let TopRowUnits: ReturnType<typeof getUnits> = [];
    let BottomRowUnits: ReturnType<typeof getUnits> | Date[] = [];
    let showDayView = false;

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
            break;
        default:
             if (scale > 20) {
                 TopRowUnits = getMonths(startDate, endDate);
                 showDayView = true;
             } else {
                 TopRowUnits = getMonths(startDate, endDate);
                 BottomRowUnits = getWeeks(startDate, endDate);
             }
    }

    const renderUnit = (unit: any, index: number, isBottomRow = false) => {
         const offsetDays = fastDifferenceInCalendarDays(unit.date, startDate);
         const left = offsetDays * scale;
         const width = unit.days * scale;

         const right = left + width;
         // Visibility check with buffer
         const buffer = 100; // pixels
         const vStart = (visibleStartX ?? 0) - buffer;
         const vEnd = (visibleEndX ?? Infinity) + buffer;

         if (right < vStart || left > vEnd) return null;

         return (
            <div
                key={unit.key}
                className="flex items-center justify-center flex-shrink-0 text-center border-r overflow-hidden absolute top-0 h-full bg-background"
                style={{
                    left: `${left}px`,
                    width: `${width}px`
                }}
            >
                <span className={isBottomRow ? "text-xs font-semibold whitespace-nowrap overflow-hidden text-ellipsis px-1" : "text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis px-1"}>
                    {unit.name}
                </span>
            </div>
         )
    }

    // Render days optimization
    const renderDays = () => {
        if (!showDayView) return null;

        const totalDays = fastDifferenceInCalendarDays(endDate, startDate) + 1;
        const vStart = visibleStartX ?? 0;
        const vEnd = visibleEndX ?? (totalDays * scale);

        const startDayIndex = Math.max(0, Math.floor(vStart / scale));
        const endDayIndex = Math.min(totalDays - 1, Math.ceil(vEnd / scale));

        const dayElements = [];
        // Add buffer
        const buffer = 5;
        const bufferedStart = Math.max(0, startDayIndex - buffer);
        const bufferedEnd = Math.min(totalDays - 1, endDayIndex + buffer);

        for (let i = bufferedStart; i <= bufferedEnd; i++) {
             const day = addDays(startDate, i);
             const left = i * scale;

             dayElements.push(
                <div
                    key={i}
                    className="flex-shrink-0 flex items-center justify-center border-r overflow-hidden absolute top-0 h-full bg-background"
                    style={{ left: `${left}px`, width: `${scale}px` }}
                >
                    <span className="text-xs">{format(day, 'd')}</span>
                </div>
             );
        }
        return dayElements;
    };

    return (
        <div className="sticky top-0 z-50 bg-background w-full">
            {/* Top Row */}
            <div className="relative border-b h-12 w-full overflow-hidden">
                {TopRowUnits.map((unit, index) => renderUnit(unit, index))}
            </div>

            {/* Bottom Row */}
            <div className="relative h-12 border-b w-full overflow-hidden">
                {showDayView ? (
                    renderDays()
                ) : (
                    (BottomRowUnits as any[]).map((unit, index) => renderUnit(unit, index, true))
                )}
            </div>
        </div>
    );
});

TimelineHeader.displayName = 'TimelineHeader';
