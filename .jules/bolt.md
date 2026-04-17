## 2024-05-24 - [Date Formatter Performance]
**Learning:** `date-fns/formatISO` is significantly slower than native string construction methods for creating ISO date strings in tight loops.
**Action:** When working in hot paths, such as the `calendarService.isWorkingDay` function where calendar scheduling math involves repeated iterations across dates, employ simple native string construction `YYYY-MM-DD` instead of heavy external formatters to optimize overall timeline rendering performance.
## 2024-05-25 - [Date Object Instantiation Overhead]
**Learning:** Functions from libraries like `date-fns` (e.g., `startOfDay`, `addDays`) create new Date objects on every invocation. In tight loops (like calculating duration over hundreds of days), this causes excessive garbage collection and significant performance drops.
**Action:** Replace `date-fns` math in hot paths with native Date mutations (`new Date()`, `.setHours()`, `.setDate()`). Always remember that `addDays` preserves the original time component, so ensure native replacements also preserve time unless explicitly zeroing out for comparison.
