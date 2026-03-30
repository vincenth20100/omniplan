import { startOfDay } from 'date-fns';

// Mock types needed
type Calendar = {
  workingDays: number[];
  exceptions?: { isActive: boolean; start: Date; finish: Date }[];
  nonWorkingDayOverrides?: string[];
  workingDayOverrides?: string[];
};

const mockCalendar: Calendar = {
  workingDays: [1, 2, 3, 4, 5],
  exceptions: [
    { isActive: true, start: new Date('2024-05-10T10:00:00Z'), finish: new Date('2024-05-12T18:00:00Z') }
  ],
  workingDayOverrides: ['2024-06-01'],
  nonWorkingDayOverrides: ['2024-12-25']
};

// Original implementation
function originalIsWorkingDay(date: Date, calendar: Calendar): boolean {
  if (!calendar) {
    const day = date.getDay();
    return day >= 1 && day <= 5;
  }
  const sDate = startOfDay(date);

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

  const year = sDate.getFullYear();
  const month = String(sDate.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(sDate.getDate()).padStart(2, '0');
  const isoDate = `${year}-${month}-${dayOfMonth}`;

  if (calendar.workingDayOverrides?.includes(isoDate)) {
      return true;
  }
  if (calendar.nonWorkingDayOverrides?.includes(isoDate)) {
      return false;
  }

  return calendar.workingDays.includes(sDate.getDay());
}

// Optimized implementation
function optimizedIsWorkingDay(date: Date, calendar: Calendar): boolean {
  if (!calendar) {
    const day = date.getDay();
    return day >= 1 && day <= 5;
  }
  const sDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (calendar.exceptions) {
    for (const ex of calendar.exceptions) {
      if (ex.isActive && ex.start && ex.finish) {
        const exStart = new Date(ex.start.getFullYear(), ex.start.getMonth(), ex.start.getDate());
        const exFinish = new Date(ex.finish.getFullYear(), ex.finish.getMonth(), ex.finish.getDate());
        if (sDate >= exStart && sDate <= exFinish) {
          return false;
        }
      }
    }
  }

  const year = sDate.getFullYear();
  const m = sDate.getMonth() + 1;
  const d = sDate.getDate();
  const month = m < 10 ? '0' + m : m;
  const dayOfMonth = d < 10 ? '0' + d : d;
  const isoDate = `${year}-${month}-${dayOfMonth}`;

  if (calendar.workingDayOverrides?.includes(isoDate)) {
      return true;
  }
  if (calendar.nonWorkingDayOverrides?.includes(isoDate)) {
      return false;
  }

  return calendar.workingDays.includes(sDate.getDay());
}

const ITERATIONS = 100000;
const testDate = new Date('2024-05-15T14:30:00Z');

console.log(`Running ${ITERATIONS} iterations...`);

const startOriginal = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  originalIsWorkingDay(testDate, mockCalendar);
}
const endOriginal = performance.now();
const timeOriginal = endOriginal - startOriginal;

const startOptimized = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  optimizedIsWorkingDay(testDate, mockCalendar);
}
const endOptimized = performance.now();
const timeOptimized = endOptimized - startOptimized;

console.log(`Original: ${timeOriginal.toFixed(2)}ms`);
console.log(`Optimized: ${timeOptimized.toFixed(2)}ms`);
console.log(`Improvement: ${((timeOriginal - timeOptimized) / timeOriginal * 100).toFixed(2)}% faster`);