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
    // ⚡ Bolt: Native date formatting is significantly faster than date-fns startOfDay
    // and formatISO. This optimization is crucial because isWorkingDay is called
    // repeatedly in loops for duration calculations and scheduling.
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const sDate = new Date(year, month, day);
    const sTime = sDate.getTime();

    // Check exceptions first. Exceptions are non-working days.
    if (calendar.exceptions && calendar.exceptions.length > 0) {
      for (let i = 0; i < calendar.exceptions.length; i++) {
        const ex = calendar.exceptions[i];
        if (ex.isActive && ex.start && ex.finish) {
          const exStart = new Date(ex.start.getFullYear(), ex.start.getMonth(), ex.start.getDate()).getTime();
          const exFinish = new Date(ex.finish.getFullYear(), ex.finish.getMonth(), ex.finish.getDate()).getTime();
          if (sTime >= exStart && sTime <= exFinish) {
            return false;
          }
        }
      }
    }
    
    const m = month + 1;
    const isoDate = `${year}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
    
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
