## 2024-05-24 - [Date Formatter Performance]
**Learning:** `date-fns/formatISO` is significantly slower than native string construction methods for creating ISO date strings in tight loops.
**Action:** When working in hot paths, such as the `calendarService.isWorkingDay` function where calendar scheduling math involves repeated iterations across dates, employ simple native string construction `YYYY-MM-DD` instead of heavy external formatters to optimize overall timeline rendering performance.
## 2024-06-25 - [Date-fns Loop Performance]
**Learning:** `date-fns` functions like `startOfDay` and `addDays` are significantly slower than native Date manipulations (`new Date()`, `.setDate()`, `.setHours()`) when executed inside tight loops, due to internal object instantiations and checks. Furthermore, formatting dates unnecessarily in loops when override lists are empty wastes CPU cycles.
**Action:** In high-frequency loop paths (e.g., `calendarService` algorithms calculating durations), replace `date-fns` with direct native Date object modifications. Always bypass string interpolation formatting if the target arrays/lists (like `workingDayOverrides`) are empty.
