'use client';
import { addDays, addMonths, startOfDay, differenceInCalendarDays, isSameDay } from 'date-fns';
import type { Calendar, DurationUnit, Exception } from './types';

class CalendarService {

  public isWorkingDay(date: Date, calendar: Calendar): boolean {
    if (!calendar) {
      // This is a fallback to prevent crashes if a calendar is not provided.
      // It assumes a standard Monday-Friday work week.
      console.warn("isWorkingDay called without a calendar. Falling back to a standard work week.");
      const day = date.getDay();
      return day >= 1 && day <= 5;
    }
    const sDate = startOfDay(date);
    const sTime = sDate.getTime();

    // Check exceptions first. Exceptions are non-working days.
    if (calendar.exceptions && calendar.exceptions.length > 0) {
      for (let i = 0; i < calendar.exceptions.length; i++) {
        const ex = calendar.exceptions[i];
        if (ex.isActive && ex.start && ex.finish) {
          const exStart = startOfDay(ex.start).getTime();
          const exFinish = startOfDay(ex.finish).getTime();
          if (sTime >= exStart && sTime <= exFinish) {
            return false;
          }
        }
      }
    }
    
    // ⚡ Bolt: Only format date strings if overrides exist to save allocation in hot loops
    const hasOverrides = (calendar.workingDayOverrides && calendar.workingDayOverrides.length > 0) ||
                         (calendar.nonWorkingDayOverrides && calendar.nonWorkingDayOverrides.length > 0);
    
    if (hasOverrides) {
        // Native date formatting is significantly faster than date-fns formatISO
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
    }

    // Check default working days
    return calendar.workingDays.includes(sDate.getDay());
  }
  
  public findNextWorkingDay(date: Date, calendar: Calendar, direction: 1 | -1 = 1): Date {
    let nextDay = date;
    while (!this.isWorkingDay(nextDay, calendar)) {
      nextDay = addDays(nextDay, direction);
    }
    return nextDay;
  }
  
  public addWorkingDays(startDate: Date, days: number, calendar: Calendar): Date {
    let currentDate = startDate;
    let daysToAdd = Math.floor(days);

    if (daysToAdd === 0) {
      if (!this.isWorkingDay(currentDate, calendar)) {
         return this.findNextWorkingDay(currentDate, calendar, 1);
      }
      return currentDate;
    }
    
    const direction = daysToAdd > 0 ? 1 : -1;
    let remainingDays = Math.abs(daysToAdd);

    // Standard loop for complex calendars
    // Note: Mathematical optimization was attempted here but removed due to edge cases
    // with starting on non-working days. The loop is fast enough for typical project durations.
    while (remainingDays > 0) {
      currentDate = addDays(currentDate, direction);
      if (this.isWorkingDay(currentDate, calendar)) {
        remainingDays--;
      }
    }
    
    return currentDate;
  }
  
  public getWorkingDaysDuration(start: Date, end: Date, calendar: Calendar): number {
    const d1 = startOfDay(start);
    const d2 = startOfDay(end);

    const reverse = d1 > d2;
    const startDate = reverse ? d2 : d1;
    const endDate = reverse ? d1 : d2;

    let count = 0;

    // Standard iteration for calendars with exceptions or overrides
    // Note: Mathematical optimization was attempted here but removed due to edge cases
    // with starting on non-working days and time-aware differences.
    // The loop is fast enough for typical project durations when combined with the isWorkingDay optimization.
    let currentDate = startDate;
    while(currentDate <= endDate) {
      if (this.isWorkingDay(currentDate, calendar)) {
        count++;
      }
      currentDate = addDays(currentDate, 1);
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
