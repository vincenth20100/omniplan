## 2024-05-24 - [Date Formatter Performance]
**Learning:** `date-fns/formatISO` is significantly slower than native string construction methods for creating ISO date strings in tight loops.
**Action:** When working in hot paths, such as the `calendarService.isWorkingDay` function where calendar scheduling math involves repeated iterations across dates, employ simple native string construction `YYYY-MM-DD` instead of heavy external formatters to optimize overall timeline rendering performance.
## 2024-05-24 - [Date Math Performance]
**Learning:** `date-fns/startOfDay` and `date-fns/addDays` are significantly slower than native Date object mutations (`new Date().setHours(0,0,0,0)` and `date.setDate(date.getDate() + 1)`) because the library instantiates multiple Date objects internally and adds heavy boundary checks.
**Action:** When working in hot paths like duration and scheduling loops (`getWorkingDaysDuration`, `addWorkingDays`), use native Date constructor and mutators to save memory allocation and computation time. Furthermore, inline ternary operators (e.g., `m < 10 ? '0' + m : m`) are noticeably faster than `String().padStart()` in these tight loops.
