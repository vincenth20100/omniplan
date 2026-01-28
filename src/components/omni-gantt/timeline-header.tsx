'use client';
import { addDays, differenceInDays, format, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval } from 'date-fns';
import React from 'react';

const getMonths = (startDate: Date, endDate: Date) => {
    const months = [];
    let currentDate = startOfMonth(startDate);
    while (currentDate <= endDate) {
        const monthEnd = endOfMonth(currentDate);
        const effectiveEndDate = monthEnd > endDate ? endDate : monthEnd;
        const daysInMonth = differenceInDays(effectiveEndDate, currentDate) + 1;
        months.push({
            name: format(currentDate, 'MMMM yyyy'),
            days: daysInMonth,
            date: currentDate
        });
        currentDate = addDays(startOfMonth(currentDate), 31);
    }
    return months;
};

const getWeeks = (startDate: Date, endDate: Date) => {
    const weeks = [];
    const weekIntervals = eachWeekOfInterval({ start: startDate, end: endDate });
    for (let i = 0; i < weekIntervals.length; i++) {
        const weekStart = weekIntervals[i];
        const weekEnd = i + 1 < weekIntervals.length ? addDays(weekIntervals[i+1], -1) : endDate;
        const daysInWeek = differenceInDays(weekEnd, weekStart) + 1;
        weeks.push({
            name: `W${format(weekStart, 'w')}`,
            days: daysInWeek,
            date: weekStart
        });
    }
    return weeks;
};

export const TimelineHeader = React.memo(({ startDate, endDate, scale }: { startDate: Date, endDate: Date, scale: number }) => {
    const months = getMonths(startDate, endDate);
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const weeks = getWeeks(startDate, endDate);

    const showDayView = scale > 20;

    return (
        <div className="sticky top-0 z-20 bg-card">
            <div className="relative flex border-b h-6">
                {months.map((month) => (
                    <div
                        key={month.name}
                        className="flex items-center justify-center flex-shrink-0 text-center border-r"
                        style={{ width: month.days * scale }}
                    >
                        <span className="text-sm font-semibold">
                            {month.name}
                        </span>
                    </div>
                ))}
            </div>
            <div className="relative flex h-6">
                {showDayView ? (
                    days.map((day, index) => (
                        <div
                            key={index}
                            className="flex-shrink-0 flex items-center justify-center border-r"
                            style={{ width: scale }}
                        >
                            <span className="text-xs">{format(day, 'd')}</span>
                        </div>
                    ))
                ) : (
                     weeks.map((week) => (
                        <div
                            key={week.date.toISOString()}
                            className="flex items-center justify-center flex-shrink-0 text-center border-r"
                            style={{ width: week.days * scale }}
                        >
                            <span className="text-xs font-semibold">
                                {week.name}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
});

TimelineHeader.displayName = 'TimelineHeader';
