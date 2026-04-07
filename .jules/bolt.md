## 2024-05-24 - [Date Formatter Performance]
**Learning:** `date-fns/formatISO` is significantly slower than native string construction methods for creating ISO date strings in tight loops.
**Action:** When working in hot paths, such as the `calendarService.isWorkingDay` function where calendar scheduling math involves repeated iterations across dates, employ simple native string construction `YYYY-MM-DD` instead of heavy external formatters to optimize overall timeline rendering performance.
## 2024-05-24 - [Date Object Instantiation Overhead in Loops]
**Learning:** `date-fns` functions like `startOfDay` and `addDays` incur significant performance overhead in tight loops due to repeated Date object instantiations and internal wrappers. In V8, `String.prototype.padStart` is also surprisingly slower than inline ternaries for simple 2-digit padding.
**Action:** When performing heavy date math in hot paths (like `calendarService` loop operations), clone the Date object once and mutate it in place using native methods (`setHours(0,0,0,0)`, `setDate(getDate() + 1)`). Use inline ternaries for zero-padding date strings.
