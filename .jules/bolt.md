## 2024-05-24 - [Date Formatter Performance]
**Learning:** `date-fns/formatISO` is significantly slower than native string construction methods for creating ISO date strings in tight loops.
**Action:** When working in hot paths, such as the `calendarService.isWorkingDay` function where calendar scheduling math involves repeated iterations across dates, employ simple native string construction `YYYY-MM-DD` instead of heavy external formatters to optimize overall timeline rendering performance.
## 2024-05-20 - date-fns performance overhead in tight loops
**Learning:** Utilities like `startOfDay` and `addDays` from `date-fns` incur substantial overhead when called in tight loops because they create new Date objects and perform internal checking.
**Action:** In calendar logic and hot paths where loops execute hundreds or thousands of times, use native `new Date()` construction and in-place `.setDate()` mutations instead to reduce garbage collection pressure.
