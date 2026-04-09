## 2024-05-24 - [Date Formatter Performance]
**Learning:** `date-fns/formatISO` is significantly slower than native string construction methods for creating ISO date strings in tight loops.
**Action:** When working in hot paths, such as the `calendarService.isWorkingDay` function where calendar scheduling math involves repeated iterations across dates, employ simple native string construction `YYYY-MM-DD` instead of heavy external formatters to optimize overall timeline rendering performance.
## 2024-05-25 - [React Props Immutability in Optimizations]
**Learning:** Adding caching properties directly onto passed array items (e.g. `(ex as any)._startMs = ...`) to prevent re-instantiating inner loop parsing is a severe anti-pattern in React apps ('use client'). Props and state objects are often strictly frozen, and mutation throws blocking TypeErrors.
**Action:** When calculating repeated values from objects in hot paths, avoid mutating the argument. Rely on local variable scoping inside the loop instead, even if it entails repeated parsing. The cost of parsing native dates is still much lower than causing an application crash via invalid mutation.
