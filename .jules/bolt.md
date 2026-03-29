## 2024-05-24 - [Date Formatter Performance]
**Learning:** `date-fns/formatISO` is significantly slower than native string construction methods for creating ISO date strings in tight loops.
**Action:** When working in hot paths, such as the `calendarService.isWorkingDay` function where calendar scheduling math involves repeated iterations across dates, employ simple native string construction `YYYY-MM-DD` instead of heavy external formatters to optimize overall timeline rendering performance.
## 2026-03-29 - [Native Date Construction vs date-fns startOfDay Performance]
**Learning:** `date-fns/startOfDay` creates multiple objects internally and is significantly slower than manual native `Date(year, month, day)` construction. This overhead multiplies catastrophically when checking numerous dates inside a loop.
**Action:** Avoid `startOfDay` inside tight loop functions such as calendar scheduling checks (`isWorkingDay`). Constructing native Date components or using `.setHours(0,0,0,0)` on a cloned Date drastically reduces calculation time.
