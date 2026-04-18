## 2024-05-24 - [Date Formatter Performance]
**Learning:** `date-fns/formatISO` is significantly slower than native string construction methods for creating ISO date strings in tight loops.
**Action:** When working in hot paths, such as the `calendarService.isWorkingDay` function where calendar scheduling math involves repeated iterations across dates, employ simple native string construction `YYYY-MM-DD` instead of heavy external formatters to optimize overall timeline rendering performance.
## 2024-05-24 - [Date Creation and Date Library Impact on Tight Loops]
**Learning:** Functions like `date-fns/startOfDay` and `date-fns/addDays` instantiate multiple new Date objects internally. In hot paths like 10-year iterations of calendar exception checks (`getWorkingDaysDuration` or scheduling large projects), this massive object creation triggers severe garbage collection overhead, completely tanking performance. Additionally, parsing exception string dates on every tick of the loop is an enormous bottleneck.
**Action:** In loops performing calendar logic, always replace `date-fns` math with native, in-place Date mutations (e.g., `d.setDate(d.getDate() + 1)` instead of `addDays(d, 1)` and `new Date(year, month, day)` instead of `startOfDay(d)`).

## 2024-05-24 - [Safe Caching for React Props]
**Learning:** Next.js/React heavily relies on treating prop objects (like a `calendar` definition passed to components) as immutable or frozen. Modifying these objects directly to store cached parsed values (e.g., attaching `_parsedExceptions` to `calendar`) causes strict-mode crashes and regressions in client components.
**Action:** When a performance bottleneck requires caching derived data from a read-only prop in a utility function, use a module-level `WeakMap`. This associates the computed data with the specific object instance safely without modifying the object itself, automatically clearing memory when the object is garbage collected.
