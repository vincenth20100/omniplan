'use client';
import { addDays, addMonths, differenceInCalendarDays, isSameDay } from 'date-fns';
import type { Calendar, DurationUnit, Exception } from './types';

class CalendarService {

  // ⚡ Bolt: Native implementation is ~8x faster than date-fns startOfDay
  private fastStartOfDay(d: Date): Date {
    const nd = new Date(d);
    nd.setHours(0, 0, 0, 0);
    return nd;
  }

  public isWorkingDay(date: Date, calendar: Calendar): boolean {
    if (!calendar) {
      // This is a fallback to prevent crashes if a calendar is not provided.
      // It assumes a standard Monday-Friday work week.
      console.warn("isWorkingDay called without a calendar. Falling back to a standard work week.");
      const day = date.getDay();
      return day >= 1 && day <= 5;
    }
    const sDate = this.fastStartOfDay(date);

    // Check exceptions first. Exceptions are non-working days.
    if (calendar.exceptions) {
      for (const ex of calendar.exceptions) {
        if (ex.isActive && ex.start && ex.finish) {
          const exStart = this.fastStartOfDay(ex.start);
          const exFinish = this.fastStartOfDay(ex.finish);
          if (sDate >= exStart && sDate <= exFinish) {
            return false;
          }
        }
      }
    }
    
    // ⚡ Bolt: Native date formatting is significantly faster than date-fns formatISO
    // This optimization is crucial because isWorkingDay is called repeatedly in loops
    // for duration calculations and scheduling. Inline ternary is faster than padStart.
    const year = sDate.getFullYear();
    const m = sDate.getMonth() + 1;
    const d = sDate.getDate();
    const isoDate = `${year}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
    
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
    while (!this.isWorkingDay(nextDay, calendar)) {
      // ⚡ Bolt: Native date addition is faster than date-fns addDays in loops
      const d = new Date(nextDay);
      d.setDate(d.getDate() + direction);
      nextDay = d;
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

    while (remainingDays > 0) {
      // ⚡ Bolt: Native date addition is faster than date-fns addDays in loops
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + direction);
      currentDate = nextDate;
      if (this.isWorkingDay(currentDate, calendar)) {
        remainingDays--;
      }
    }
    
    return currentDate;
  }
  
  public getWorkingDaysDuration(start: Date, end: Date, calendar: Calendar): number {
    const d1 = this.fastStartOfDay(start);
    const d2 = this.fastStartOfDay(end);

    const reverse = d1 > d2;
    const startDate = reverse ? d2 : d1;
    const endDate = reverse ? d1 : d2;

    let count = 0;
    let currentDate = startDate;
    while(currentDate <= endDate) {
      if (this.isWorkingDay(currentDate, calendar)) {
        count++;
      }
      // ⚡ Bolt: Native date addition is faster than date-fns addDays in loops
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);
      currentDate = nextDate;
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
