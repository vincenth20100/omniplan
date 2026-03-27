## 2024-05-24 - [Date Formatter Performance]
**Learning:** `date-fns/formatISO` is significantly slower than native string construction methods for creating ISO date strings in tight loops.
**Action:** When working in hot paths, such as the `calendarService.isWorkingDay` function where calendar scheduling math involves repeated iterations across dates, employ simple native string construction `YYYY-MM-DD` instead of heavy external formatters to optimize overall timeline rendering performance.

## 2024-05-25 - [Date Math Optimization]
**Learning:** `date-fns/differenceInCalendarDays` is unexpectedly slow when called thousands of times per render loop (like calculating coordinate mathematics for Gantt chart items).
**Action:** When calculating pixel coordinates based on dates in hot-paths, employ simple native `Date.UTC` math (calculating difference in milliseconds and dividing by `86400000`) as it's nearly 15x faster than using `date-fns`.
