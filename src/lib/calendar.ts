import { addDays, isWeekend, startOfDay, differenceInCalendarDays } from 'date-fns';

class CalendarService {
  private workingDays: number[] = [1, 2, 3, 4, 5]; // Mon-Fri

  public addWorkingDays(startDate: Date, days: number): Date {
    let currentDate = startDate;
    let daysToAdd = Math.floor(days);

    if (daysToAdd === 0) {
      if (!this.isWorkingDay(currentDate)) {
         return this.findNextWorkingDay(currentDate, 1);
      }
      return currentDate;
    }
    
    const direction = daysToAdd > 0 ? 1 : -1;
    let remainingDays = Math.abs(daysToAdd);

    while (remainingDays > 0) {
      currentDate = addDays(currentDate, direction);
      if (this.isWorkingDay(currentDate)) {
        remainingDays--;
      }
    }
    
    return currentDate;
  }
  
  public getWorkingDaysDuration(start: Date, end: Date): number {
    let duration = 0;
    let currentDate = startOfDay(start);
    const endDate = startOfDay(end);

    if (currentDate >= endDate) return 1;
    
    const totalDays = differenceInCalendarDays(endDate, currentDate);
    for (let i = 0; i <= totalDays; i++) {
        if (this.isWorkingDay(addDays(currentDate, i))) {
            duration++;
        }
    }
    
    return duration > 0 ? duration : 1;
  }

  public isWorkingDay(date: Date): boolean {
    return !isWeekend(date);
  }

  public findNextWorkingDay(date: Date, direction: 1 | -1 = 1): Date {
    let nextDay = date;
    while (!this.isWorkingDay(nextDay)) {
      nextDay = addDays(nextDay, direction);
    }
    return nextDay;
  }
}

export const calendarService = new CalendarService();
