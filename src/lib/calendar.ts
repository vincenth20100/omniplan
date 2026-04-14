'use client';
import { addDays, addMonths, startOfDay, differenceInCalendarDays, isSameDay } from 'date-fns';
import type { Calendar, DurationUnit, Exception } from './types';

const exceptionCache = new WeakMap<Calendar, Map<Exception, { start: number, finish: number }>>();

class CalendarService {

  public isWorkingDay(date: Date, calendar: Calendar): boolean {
    if (!calendar) {
      // This is a fallback to prevent crashes if a calendar is not provided.
      // It assumes a standard Monday-Friday work week.
      console.warn("isWorkingDay called without a calendar. Falling back to a standard work week.");
      const day = date.getDay();
      return day >= 1 && day <= 5;
    }

    // ⚡ Bolt: Native date construction is faster than date-fns startOfDay which instantiates multiple objects
    const sDate = new Date(date);
    sDate.setHours(0, 0, 0, 0);
    const sTime = sDate.getTime();

    // Check exceptions first. Exceptions are non-working days.
    if (calendar.exceptions) {
      let exCache = exceptionCache.get(calendar);
      if (!exCache) {
          exCache = new Map();
          exceptionCache.set(calendar, exCache);
      }
      for (const ex of calendar.exceptions) {
        if (ex.isActive && ex.start && ex.finish) {
          let cached = exCache.get(ex);
          if (!cached) {
            // Cache normalized timestamp bounds to avoid parsing date strings in tight loops
            cached = {
              start: new Date(ex.start).setHours(0, 0, 0, 0),
              finish: new Date(ex.finish).setHours(0, 0, 0, 0)
            };
            exCache.set(ex, cached);
          }
          if (sTime >= cached.start && sTime <= cached.finish) {
            return false;
          }
        }
      }
    }
    
    // ⚡ Bolt: Native date formatting is significantly faster than date-fns formatISO
    // This optimization is crucial because isWorkingDay is called repeatedly in loops
    // for duration calculations and scheduling.
    const year = sDate.getFullYear();
    const mVal = sDate.getMonth() + 1;
    const dVal = sDate.getDate();
    // Use fast zero-padding ternary instead of string padding for hot paths
    const month = mVal < 10 ? '0' + mVal : mVal;
    const dayOfMonth = dVal < 10 ? '0' + dVal : dVal;
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
    const nextDay = new Date(date);
    while (!this.isWorkingDay(nextDay, calendar)) {
      nextDay.setDate(nextDay.getDate() + direction);
    }
    return nextDay;
  }
  
  public addWorkingDays(startDate: Date, days: number, calendar: Calendar): Date {
    const currentDate = new Date(startDate);
    const daysToAdd = Math.floor(days);

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
    const currentDate = new Date(startDate);
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
