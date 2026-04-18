'use client';
import { addDays, addMonths, startOfDay, differenceInCalendarDays, isSameDay } from 'date-fns';
import type { Calendar, DurationUnit, Exception } from './types';

// Cache for parsed exception dates to avoid repetitive Date parsing in tight loops.
// Using WeakMap to safely cache derived data for read-only React prop objects.
const calendarExceptionCache = new WeakMap<Calendar, {start: number, finish: number}[]>();

class CalendarService {

  public isWorkingDay(date: Date, calendar: Calendar): boolean {
    if (!calendar) {
      // This is a fallback to prevent crashes if a calendar is not provided.
      // It assumes a standard Monday-Friday work week.
      console.warn("isWorkingDay called without a calendar. Falling back to a standard work week.");
      const day = date.getDay();
      return day >= 1 && day <= 5;
    }

    // ⚡ Bolt: Native start of day without library overhead
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    // Use getTime() for faster comparisons below
    const sDateTime = new Date(year, month, day).getTime();

    // Check exceptions first. Exceptions are non-working days.
    if (calendar.exceptions && calendar.exceptions.length > 0) {
      let cachedExceptions = calendarExceptionCache.get(calendar);

      if (!cachedExceptions) {
        // Parse and cache exceptions on first access
        cachedExceptions = calendar.exceptions
          .filter(ex => ex.isActive && ex.start && ex.finish)
          .map(ex => {
            const start = new Date(ex.start!);
            start.setHours(0, 0, 0, 0);
            const finish = new Date(ex.finish!);
            finish.setHours(0, 0, 0, 0);
            return {
              start: start.getTime(),
              finish: finish.getTime()
            };
          });
        calendarExceptionCache.set(calendar, cachedExceptions);
      }

      for (let i = 0; i < cachedExceptions.length; i++) {
        const ex = cachedExceptions[i];
        if (sDateTime >= ex.start && sDateTime <= ex.finish) {
          return false;
        }
      }
    }
    
    // ⚡ Bolt: Native date formatting is significantly faster than date-fns formatISO
    // This optimization is crucial because isWorkingDay is called repeatedly in loops
    // for duration calculations and scheduling. Using inline ternary for faster zero-padding.
    const m = month + 1;
    const mStr = m < 10 ? '0' + m : m;
    const dStr = day < 10 ? '0' + day : day;
    const isoDate = `${year}-${mStr}-${dStr}`;
    
    // Check overrides
    if (calendar.workingDayOverrides && calendar.workingDayOverrides.length > 0 && calendar.workingDayOverrides.includes(isoDate)) {
        return true;
    }
    if (calendar.nonWorkingDayOverrides && calendar.nonWorkingDayOverrides.length > 0 && calendar.nonWorkingDayOverrides.includes(isoDate)) {
        return false;
    }

    // Check default working days
    return calendar.workingDays.includes(date.getDay());
  }
  
  public findNextWorkingDay(date: Date, calendar: Calendar, direction: 1 | -1 = 1): Date {
    let nextDay = new Date(date);
    while (!this.isWorkingDay(nextDay, calendar)) {
      // ⚡ Bolt: Fast inline date manipulation instead of addDays to avoid garbage collection
      nextDay.setDate(nextDay.getDate() + direction);
    }
    return nextDay;
  }
  
  public addWorkingDays(startDate: Date, days: number, calendar: Calendar): Date {
    let currentDate = new Date(startDate);
    let daysToAdd = Math.floor(days);

    if (daysToAdd === 0) {
      if (!this.isWorkingDay(currentDate, calendar)) {
         return this.findNextWorkingDay(currentDate, calendar, 1);
      }
      return currentDate;
    }
    
    const direction = daysToAdd > 0 ? 1 : -1;
    let remainingDays = Math.abs(daysToAdd);

    while (remainingDays > 0) {
      // ⚡ Bolt: Fast inline date manipulation
      currentDate.setDate(currentDate.getDate() + direction);
      if (this.isWorkingDay(currentDate, calendar)) {
        remainingDays--;
      }
    }
    
    return currentDate;
  }
  
  public getWorkingDaysDuration(start: Date, end: Date, calendar: Calendar): number {
    // ⚡ Bolt: Native start of day
    const d1 = new Date(start);
    d1.setHours(0, 0, 0, 0);
    const d2 = new Date(end);
    d2.setHours(0, 0, 0, 0);

    const reverse = d1 > d2;
    const startDate = reverse ? d2 : d1;
    const endDate = reverse ? d1 : d2;

    let count = 0;
    const currentDate = new Date(startDate);
    const endMs = endDate.getTime();

    while(currentDate.getTime() <= endMs) {
      if (this.isWorkingDay(currentDate, calendar)) {
        count++;
      }
      // ⚡ Bolt: Fast inline date manipulation instead of addDays
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return reverse ? -count : count;
  }

  public calculateFinishDate(startDate: Date, duration: number, unit: DurationUnit, calendar: Calendar): Date {
      if (duration === 0) {
          // A zero-duration task (milestone) finishes on its start date.
          // The scheduler should ensure the start date is already a working day.
          return startDate;
      }

      const durationValue = duration > 0 ? duration - 1 : duration;
      switch (unit) {
          case 'ed': // elapsed days
              return addDays(startDate, durationValue);
          case 'm': // calendar months
          case 'em': // elapsed months
              return addDays(addMonths(startDate, duration), -1);
          case 'd': // working days
          default:
              return this.addWorkingDays(startDate, durationValue, calendar);
      }
  }
}

export const calendarService = new CalendarService();
