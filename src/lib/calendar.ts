'use client';
import { addMonths } from 'date-fns';
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

    // Check exceptions first. Exceptions are non-working days.
    if (calendar.exceptions && calendar.exceptions.length > 0) {
      const sDateMs = new Date(date).setHours(0,0,0,0);
      for (let i = 0; i < calendar.exceptions.length; i++) {
        const ex = calendar.exceptions[i];
        if (ex.isActive && ex.start && ex.finish) {
          const exStartMs = new Date(ex.start).setHours(0,0,0,0);
          const exFinishMs = new Date(ex.finish).setHours(0,0,0,0);
          if (sDateMs >= exStartMs && sDateMs <= exFinishMs) {
            return false;
          }
        }
      }
    }
    
    // ⚡ Bolt: Native date formatting is significantly faster than date-fns formatISO
    // This optimization is crucial because isWorkingDay is called repeatedly in loops
    // for duration calculations and scheduling.
    
    // Only construct ISO string if there are actual overrides to check
    if ((calendar.workingDayOverrides && calendar.workingDayOverrides.length > 0) ||
        (calendar.nonWorkingDayOverrides && calendar.nonWorkingDayOverrides.length > 0)) {

        const year = date.getFullYear();
        const monthRaw = date.getMonth() + 1;
        const dayOfMonthRaw = date.getDate();
        const month = monthRaw < 10 ? '0' + monthRaw : monthRaw;
        const dayOfMonth = dayOfMonthRaw < 10 ? '0' + dayOfMonthRaw : dayOfMonthRaw;
        const isoDate = `${year}-${month}-${dayOfMonth}`;

        // Check overrides
        if (calendar.workingDayOverrides && calendar.workingDayOverrides.includes(isoDate)) {
            return true;
        }
        if (calendar.nonWorkingDayOverrides && calendar.nonWorkingDayOverrides.includes(isoDate)) {
            return false;
        }
    }

    // Check default working days
    return calendar.workingDays.includes(date.getDay());
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
    const d1 = new Date(start); d1.setHours(0,0,0,0);
    const d2 = new Date(end); d2.setHours(0,0,0,0);

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
              const res = new Date(startDate);
              res.setDate(res.getDate() + durationValue);
              return res;
          case 'm': // calendar months
          case 'em': // elapsed months
              const res2 = addMonths(startDate, duration);
              res2.setDate(res2.getDate() - 1);
              return res2;
          case 'd': // working days
          default:
              return this.addWorkingDays(startDate, durationValue, calendar);
      }
  }
}

export const calendarService = new CalendarService();
