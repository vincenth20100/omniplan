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

    // Optimize: only instantiate/setHours if not already 00:00:00.000 to save allocations in loops
    let sDate = date;
    if (sDate.getHours() !== 0 || sDate.getMinutes() !== 0 || sDate.getSeconds() !== 0 || sDate.getMilliseconds() !== 0) {
      sDate = new Date(date);
      sDate.setHours(0, 0, 0, 0);
    }

    // Check exceptions first. Exceptions are non-working days.
    if (calendar.exceptions) {
      for (const ex of calendar.exceptions) {
        if (ex.isActive && ex.start && ex.finish) {
          const exStart = new Date(ex.start);
          exStart.setHours(0, 0, 0, 0);
          const exFinish = new Date(ex.finish);
          exFinish.setHours(0, 0, 0, 0);

          if (sDate >= exStart && sDate <= exFinish) {
            return false;
          }
        }
      }
    }
    
    // ⚡ Bolt: Native date formatting is significantly faster than date-fns formatISO
    // This optimization is crucial because isWorkingDay is called repeatedly in loops
    // for duration calculations and scheduling. Using inline ternaries is faster than padStart.
    const year = sDate.getFullYear();
    const month = sDate.getMonth() + 1;
    const dayOfMonth = sDate.getDate();

    const mStr = month < 10 ? '0' + month : month;
    const dStr = dayOfMonth < 10 ? '0' + dayOfMonth : dayOfMonth;
    const isoDate = `${year}-${mStr}-${dStr}`;
    
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
    // Return a new date to prevent mutating the input if it hasn't been cloned
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
    // We can clone startDate because we will mutate it
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
