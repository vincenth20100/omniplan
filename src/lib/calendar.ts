'use client';
import { addDays, addMonths, startOfDay, differenceInCalendarDays, isSameDay } from 'date-fns';
import type { Calendar, DurationUnit, Exception } from './types';

// Use a WeakMap to cache parsed exceptions without mutating the React props
const parsedExceptionsCache = new WeakMap<Exception[], { start: Date; finish: Date }[]>();

class CalendarService {

  private getParsedExceptions(exceptions: Exception[]) {
    if (parsedExceptionsCache.has(exceptions)) {
      return parsedExceptionsCache.get(exceptions)!;
    }

    const parsed = exceptions
      .filter((ex) => ex.isActive && ex.start && ex.finish)
      .map((ex) => {
        const start = new Date(ex.start);
        start.setHours(0, 0, 0, 0);
        const finish = new Date(ex.finish);
        finish.setHours(0, 0, 0, 0);
        return { start, finish };
      });

    parsedExceptionsCache.set(exceptions, parsed);
    return parsed;
  }

  public isWorkingDay(date: Date, calendar: Calendar): boolean {
    if (!calendar) {
      // This is a fallback to prevent crashes if a calendar is not provided.
      // It assumes a standard Monday-Friday work week.
      console.warn("isWorkingDay called without a calendar. Falling back to a standard work week.");
      const day = date.getDay();
      return day >= 1 && day <= 5;
    }

    const sDate = new Date(date);
    sDate.setHours(0, 0, 0, 0);

    // Check exceptions first. Exceptions are non-working days.
    if (calendar.exceptions && calendar.exceptions.length > 0) {
      const exceptions = this.getParsedExceptions(calendar.exceptions);
      for (let i = 0; i < exceptions.length; i++) {
        const ex = exceptions[i];
        if (sDate >= ex.start && sDate <= ex.finish) {
          return false;
        }
      }
    }
    
    // ⚡ Bolt: Native date formatting is significantly faster than date-fns formatISO
    // This optimization is crucial because isWorkingDay is called repeatedly in loops
    // for duration calculations and scheduling.
    const year = sDate.getFullYear();
    const m = sDate.getMonth() + 1;
    const month = m < 10 ? '0' + m : m;
    const d = sDate.getDate();
    const dayOfMonth = d < 10 ? '0' + d : d;
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
    const d1 = new Date(start);
    d1.setHours(0, 0, 0, 0);
    const d2 = new Date(end);
    d2.setHours(0, 0, 0, 0);

    const reverse = d1 > d2;
    const startDate = reverse ? d2 : d1;
    const endDate = reverse ? d1 : d2;

    let count = 0;
    let currentDate = new Date(startDate);
    while(currentDate <= endDate) {
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
