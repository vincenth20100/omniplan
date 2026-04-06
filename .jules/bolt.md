## 2024-05-24 - [Date Formatter Performance]
**Learning:** `date-fns/formatISO` is significantly slower than native string construction methods for creating ISO date strings in tight loops.
**Action:** When working in hot paths, such as the `calendarService.isWorkingDay` function where calendar scheduling math involves repeated iterations across dates, employ simple native string construction `YYYY-MM-DD` instead of heavy external formatters to optimize overall timeline rendering performance.
## 2024-05-25 - [Date Mutation in Tight Loops]
**Learning:** `date-fns/addDays` and `date-fns/startOfDay` allocate new Date instances on every call, making them prohibitively slow for hot paths like calendar duration calculations (`getWorkingDaysDuration` etc) which iterate day-by-day over long periods.
**Action:** When working in hot loop calculations, favor native Date mutations (`d.setDate(d.getDate() + 1)` and `d.setHours(0,0,0,0)`) over external pure functions to prevent memory allocations and substantially speed up calendar logic.
