## 2024-05-24 - [Date Formatter Performance]
**Learning:** `date-fns/formatISO` is significantly slower than native string construction methods for creating ISO date strings in tight loops.
**Action:** When working in hot paths, such as the `calendarService.isWorkingDay` function where calendar scheduling math involves repeated iterations across dates, employ simple native string construction `YYYY-MM-DD` instead of heavy external formatters to optimize overall timeline rendering performance.
## 2026-04-03 - [Date Instantiation Overhead in Hot Paths]
**Learning:** Instantiating new Date objects via libraries like `date-fns/startOfDay` or `date-fns/addDays` inside tight while-loops causes significant performance overhead (40-60% slower).
**Action:** For loops that iterate over dates (like calendar duration scheduling), use native Date operations (e.g. `setHours(0,0,0,0)` or `setDate(d.getDate() + 1)`) and inline string formatting to minimize object instantiation overhead.
