## 2024-05-24 - [Date Formatter Performance]
**Learning:** `date-fns/formatISO` is significantly slower than native string construction methods for creating ISO date strings in tight loops.
**Action:** When working in hot paths, such as the `calendarService.isWorkingDay` function where calendar scheduling math involves repeated iterations across dates, employ simple native string construction `YYYY-MM-DD` instead of heavy external formatters to optimize overall timeline rendering performance.## 2024-05-24 - [Date Formatter Performance]
**Learning:** `date-fns/formatISO` is significantly slower than native string construction methods for creating ISO date strings in tight loops.
**Action:** When working in hot paths, such as the `calendarService.isWorkingDay` function where calendar scheduling math involves repeated iterations across dates, employ simple native string construction `YYYY-MM-DD` instead of heavy external formatters to optimize overall timeline rendering performance.

## 2024-05-24 - [Date Mutability Performance in Render Loops]
**Learning:** `date-fns/format` and `date-fns/addDays` are major bottlenecks in deeply nested React render loops (like `ResourceUsageView` chart and grid generation) because they evaluate formatting templates dynamically and constantly instantiate new Date objects.
**Action:** When iterating over dates in render loops, instantiate a single native Date object and use mutable methods like `d.setDate(d.getDate() + 1)` alongside native getters and string concatenation (e.g., zero-padded month/day interpolation) to vastly reduce garbage collection overhead and rendering times.
