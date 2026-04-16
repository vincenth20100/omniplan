'use client';
import { addDays, addMonths, differenceInCalendarDays, isSameDay } from 'date-fns';
import type { Calendar, DurationUnit, Exception } from './types';

// ⚡ Bolt: Cache parsed exception dates to avoid repetitive Date parsing/allocation in tight loops.
// We use a WeakMap because exception objects come from React props and are frequently frozen/read-only.
// Mutating them directly (e.g., ex._parsedStart) causes crashes in Next.js client components.
const exceptionCache = new WeakMap<Exception, { start: Date; finish: Date }>();

class CalendarService {

  public isWorkingDay(date: Date, calendar: Calendar): boolean {
    if (!calendar) {
      // This is a fallback to prevent crashes if a calendar is not provided.
      // It assumes a standard Monday-Friday work week.
      console.warn("isWorkingDay called without a calendar. Falling back to a standard work week.");
      const day = date.getDay();
      return day >= 1 && day <= 5;
    }
    // ⚡ Bolt: Avoid date-fns startOfDay here because it instantiates a new Date internally.
    // We use a single native Date instantiation which is significantly faster.
    const sDate = new Date(date);
    sDate.setHours(0, 0, 0, 0);

    // Check exceptions first. Exceptions are non-working days.
    if (calendar.exceptions) {
      for (const ex of calendar.exceptions) {
        if (ex.isActive && ex.start && ex.finish) {
          let cached = exceptionCache.get(ex);
          if (!cached) {
            const exStart = new Date(ex.start);
            exStart.setHours(0, 0, 0, 0);
            const exFinish = new Date(ex.finish);
            exFinish.setHours(0, 0, 0, 0);
            cached = { start: exStart, finish: exFinish };
            exceptionCache.set(ex, cached);
          }
          if (sDate >= cached.start && sDate <= cached.finish) {
            return false;
          }
        }
      }
    }
    
    // ⚡ Bolt: Native date formatting is significantly faster than date-fns formatISO
    // This optimization is crucial because isWorkingDay is called repeatedly in loops
    // for duration calculations and scheduling.
    const year = sDate.getFullYear();
    const month = String(sDate.getMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(sDate.getDate()).padStart(2, '0');
    const isoDate = `${year}-${month}-${dayOfMonth}`;
    
    // Check overrides
    if (calendar.workingDayOverrides?.includes(isoDate)) {
        return true;
    }
    if (calendar.nonWorkingDayOverrides?.includes(isoDate)) {
        return false;
    }

    // Check default working days
    return calendar.workingDays.includes(sDate.getDay());
  }
  
  public findNextWorkingDay(date: Date, calendar: Calendar, direction: 1 | -1 = 1): Date {
    let nextDay = new Date(date);
    while (!this.isWorkingDay(nextDay, calendar)) {
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
      currentDate.setDate(currentDate.getDate() + direction);
      if (this.isWorkingDay(currentDate, calendar)) {
        remainingDays--;
      }
    }
    
    return currentDate;
  }
  
  public getWorkingDaysDuration(start: Date, end: Date, calendar: Calendar): number {
    // ⚡ Bolt: Fast startOfDay equivalent without object creation overhead
    const d1 = new Date(start);
    d1.setHours(0, 0, 0, 0);
    const d2 = new Date(end);
    d2.setHours(0, 0, 0, 0);

    const reverse = d1 > d2;
    const startDate = reverse ? d2 : d1;
    const endDate = reverse ? d1 : d2;
    const endMs = endDate.getTime();

    let count = 0;
    let currentDate = startDate;
    while(currentDate.getTime() <= endMs) {
      if (this.isWorkingDay(currentDate, calendar)) {
        count++;
      }
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
