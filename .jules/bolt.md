## 2024-05-24 - [Date Formatter Performance]
**Learning:** `date-fns/formatISO` is significantly slower than native string construction methods for creating ISO date strings in tight loops.
**Action:** When working in hot paths, such as the `calendarService.isWorkingDay` function where calendar scheduling math involves repeated iterations across dates, employ simple native string construction `YYYY-MM-DD` instead of heavy external formatters to optimize overall timeline rendering performance.

## 2024-05-24 - [Date Formatter Performance]
**Learning:** `date-fns/startOfDay` is ~50% slower than native Date in-place modification (`new Date().setHours(0,0,0,0)`), and `String().padStart` is ~2x slower than inline ternary operators for padding numbers.
**Action:** In hot loops such as calendar calculations (e.g., `isWorkingDay`, `getWorkingDaysDuration`), utilize native Date methods and simple ternaries for optimal performance.
