'use client';
import { addDays, addMonths, startOfDay, differenceInCalendarDays, formatISO, isSameDay } from 'date-fns';
import type { Calendar, DurationUnit, Exception } from './types';

class CalendarService {

  public isWorkingDay(date: Date, calendar: Calendar): boolean {
    const sDate = startOfDay(date);

    // Check exceptions first. Exceptions are non-working days.
    if (calendar.exceptions) {
      for (const ex of calendar.exceptions) {
        if (ex.isActive && ex.start && ex.finish) {
          const exStart = startOfDay(ex.start);
          const exFinish = startOfDay(ex.finish);
          if (sDate >= exStart && sDate <= exFinish) {
            return false;
          }
        }
      }
    }
    
    const isoDate = formatISO(sDate, { representation: 'date' });
    
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
    let duration = 0;
    let currentDate = startOfDay(start);
    const endDate = startOfDay(end);

    if (currentDate > endDate) return 1;
    
    const totalDays = differenceInCalendarDays(endDate, currentDate);
    for (let i = 0; i <= totalDays; i++) {
        if (this.isWorkingDay(addDays(currentDate, i), calendar)) {
            duration++;
        }
    }
    
    return duration > 0 ? duration : 1;
  }

  public calculateFinishDate(startDate: Date, duration: number, unit: DurationUnit, calendar: Calendar): Date {
      const durationValue = duration > 0 ? duration - 1 : 0;
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
