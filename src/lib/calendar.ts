'use client';
import { addMonths } from 'date-fns';
import type { Calendar, DurationUnit, Exception } from './types';

const exceptionStartCache = new WeakMap<Exception, Date>();
const exceptionFinishCache = new WeakMap<Exception, Date>();

class CalendarService {

  public isWorkingDay(date: Date, calendar: Calendar): boolean {
    if (!calendar) {
      // This is a fallback to prevent crashes if a calendar is not provided.
      // It assumes a standard Monday-Friday work week.
      console.warn("isWorkingDay called without a calendar. Falling back to a standard work week.");
      const day = date.getDay();
      return day >= 1 && day <= 5;
    }

    // ⚡ Bolt: Use native Date mutation for performance instead of startOfDay
    const sDate = new Date(date);
    sDate.setHours(0, 0, 0, 0);

    // Check exceptions first. Exceptions are non-working days.
    if (calendar.exceptions) {
      for (const ex of calendar.exceptions) {
        if (ex.isActive && ex.start && ex.finish) {
          // ⚡ Bolt: Cache parsed Date objects in a module-level WeakMap to avoid repeated allocations
          let exStart = exceptionStartCache.get(ex);
          if (!exStart) {
             exStart = new Date(ex.start);
             exStart.setHours(0, 0, 0, 0);
             exceptionStartCache.set(ex, exStart);
          }
          let exFinish = exceptionFinishCache.get(ex);
          if (!exFinish) {
            exFinish = new Date(ex.finish);
            exFinish.setHours(0, 0, 0, 0);
            exceptionFinishCache.set(ex, exFinish);
          }

          if (sDate >= exStart && sDate <= exFinish) {
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
    let nextDay = date;
    // ⚡ Bolt: Only instantiate a new Date if we need to loop, preserving original instance and time
    if (!this.isWorkingDay(nextDay, calendar)) {
        nextDay = new Date(nextDay);
        while (!this.isWorkingDay(nextDay, calendar)) {
            nextDay.setDate(nextDay.getDate() + direction);
        }
    }
    return nextDay;
  }
  
  public addWorkingDays(startDate: Date, days: number, calendar: Calendar): Date {
    let daysToAdd = Math.floor(days);

    if (daysToAdd === 0) {
      if (!this.isWorkingDay(startDate, calendar)) {
         return this.findNextWorkingDay(startDate, calendar, 1);
      }
      return startDate;
    }
    
    // ⚡ Bolt: Native Date instantiation instead of addDays, preserves time
    let currentDate = new Date(startDate);
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
    // ⚡ Bolt: Native Date instantiation and time reset to 00:00:00 for comparison
    const d1 = new Date(start); d1.setHours(0, 0, 0, 0);
    const d2 = new Date(end); d2.setHours(0, 0, 0, 0);

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
              const edDate = new Date(startDate);
              edDate.setDate(edDate.getDate() + durationValue);
              return edDate;
          case 'm': // calendar months
          case 'em': // elapsed months
              const emDate = addMonths(startDate, duration);
              emDate.setDate(emDate.getDate() - 1);
              return emDate;
          case 'd': // working days
          default:
              return this.addWorkingDays(startDate, durationValue, calendar);
      }
  }
}

export const calendarService = new CalendarService();
