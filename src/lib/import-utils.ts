import { Task, Link, Resource, Assignment, Calendar, LinkType, Exception } from './types';
import { formatISO, addDays } from 'date-fns';

// ─────────────────────────────────────────────────────────
// Extended import types
// ─────────────────────────────────────────────────────────

export interface DateWarning {
    taskIndex: number;
    taskName: string;
    field: string;
    rawValue: string;
    parsedAs: Date | null;
    issue: string;  // "unparseable" | "suspicious_year" | "start_after_finish" | "fallback_to_now"
}

export interface ImportedProjectData {
    name: string;
    tasks: Task[];
    links: Link[];
    resources: Resource[];
    assignments: Assignment[];
    calendars: Calendar[];
    sourceFormat?: string;
    projectInfo?: Record<string, string>;
    dateWarnings?: DateWarning[];       // Date parsing issues for review
    stats?: {                           // Quick data quality summary
        totalTasks: number;
        milestones: number;
        summaryTasks: number;
        tasksWithDates: number;
        tasksWithMissingDates: number;
        dateWarningCount: number;
        minDate: Date | null;
        maxDate: Date | null;
    };
}

function generateId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

// ─────────────────────────────────────────────────────────
// MS PROJECT XML (MSPDI) PARSER
// ─────────────────────────────────────────────────────────

interface RawCalendar {
    uid: string;
    internalId: string;
    name: string;
    baseUid?: string;
    weekDays: Map<number, boolean>; // dayIndex (0=Sun) -> isWorking
    exceptions: Exception[];
    workingDayOverrides: string[]; // ISO date strings
}

export function parseProjectXML(xmlContent: string): ImportedProjectData {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

    const root = xmlDoc.querySelector("Project");
    if (!root) throw new Error("Invalid XML: Missing <Project> tag");

    const projectName = root.querySelector("Title")?.textContent || "Imported Project";

    // 1. Calendars
    const rawCalendars = new Map<string, RawCalendar>();
    const uidToCalendarId = new Map<string, string>();

    root.querySelectorAll("Calendars > Calendar").forEach(cal => {
        const uid = cal.querySelector("UID")?.textContent;
        const name = cal.querySelector("Name")?.textContent || "Unnamed Calendar";
        const baseUid = cal.querySelector("BaseCalendarUID")?.textContent;

        if (!uid) return;

        const internalId = generateId('cal');
        uidToCalendarId.set(uid, internalId);

        const weekDays = new Map<number, boolean>();
        cal.querySelectorAll("WeekDays > WeekDay").forEach(wd => {
            const dayType = parseInt(wd.querySelector("DayType")?.textContent || "0");
            const dayWorking = wd.querySelector("DayWorking")?.textContent === "1";
            // MSPDI: 1=Sun, 2=Mon ... 7=Sat
            // JS: 0=Sun, 1=Mon ... 6=Sat
            if (dayType >= 1 && dayType <= 7) {
                weekDays.set(dayType - 1, dayWorking);
            }
        });

        const exceptions: Exception[] = [];
        const workingDayOverrides: string[] = [];

        cal.querySelectorAll("Exceptions > Exception").forEach(ex => {
            const dayWorking = ex.querySelector("DayWorking")?.textContent === "1";
            const fromDateStr = ex.querySelector("TimePeriod > FromDate")?.textContent;
            const toDateStr = ex.querySelector("TimePeriod > ToDate")?.textContent;
            const exName = ex.querySelector("Name")?.textContent || "Exception";

            if (fromDateStr && toDateStr) {
                const start = new Date(fromDateStr);
                const finish = new Date(toDateStr);

                // Adjust finish date: MSPDI ToDate is exclusive, so subtract 1ms to include correctly in range check
                finish.setMilliseconds(finish.getMilliseconds() - 1);

                if (!isNaN(start.getTime()) && !isNaN(finish.getTime())) {
                    if (!dayWorking) {
                        // Non-working exception (Holiday)
                        exceptions.push({
                            id: generateId('ex'),
                            name: exName,
                            start,
                            finish,
                            isActive: true
                        });
                    } else {
                        // Working exception (Override)
                        // Expand range to individual days
                        let current = new Date(start);
                        current.setHours(0,0,0,0);
                        const end = new Date(finish);
                        end.setHours(0,0,0,0);

                        while (current <= end) {
                            workingDayOverrides.push(formatISO(current, { representation: 'date' }));
                            current = addDays(current, 1);
                        }
                    }
                }
            }
        });

        rawCalendars.set(uid, {
            uid,
            internalId,
            name,
            baseUid: baseUid !== "-1" ? baseUid : undefined,
            weekDays,
            exceptions,
            workingDayOverrides
        });
    });

    // Resolve inheritance and build final Calendars
    const calendars: Calendar[] = [];
    rawCalendars.forEach(raw => {
        // Resolve working days
        // Strategy: Start with base calendar's working days (if exists), then apply local overrides.
        // If no base, default to Standard (Mon-Fri 8-5) IF local weekDays are empty?
        // Actually, if local WeekDays are present, they define the calendar.

        let workingDaysSet = new Set<number>();

        if (raw.baseUid && rawCalendars.has(raw.baseUid)) {
            const base = rawCalendars.get(raw.baseUid)!;
            // Recursively resolve base? For now assume 1 level of inheritance which is typical.
            // If base has base, we might need a recursive helper.
            // Let's implement a simple recursive helper for working days.
             const getWorkingDays = (r: RawCalendar): Set<number> => {
                let days = new Set<number>();
                if (r.baseUid && rawCalendars.has(r.baseUid)) {
                    days = getWorkingDays(rawCalendars.get(r.baseUid)!);
                } else {
                    // Default to Standard (Mon-Fri) if absolutely no definition?
                    // Or empty? MSPDI usually defines 'Standard' calendar fully.
                    // If this is a root calendar without definition, let's assume empty to avoid assumptions.
                    // Wait, Standard calendar usually has UID 1.
                }

                // Apply local definitions
                if (r.weekDays.size > 0) {
                    // If local definitions exist, do they replace or merge?
                    // In MSPDI, WeekDays collection replaces the base calendar's WeekDays.
                    // It's not a merge of individual days, it's a replacement of the WeekDays definition.
                    // Wait, documentation says: "If the calendar is a derived calendar, the WeekDays collection specifies the exceptions to the base calendar."
                    // So it IS a merge/override.
                    r.weekDays.forEach((isWorking, dayIndex) => {
                        if (isWorking) days.add(dayIndex);
                        else days.delete(dayIndex);
                    });
                }
                return days;
            };
            workingDaysSet = getWorkingDays(raw);
        } else {
            // No base. Use local definitions.
            if (raw.weekDays.size > 0) {
                raw.weekDays.forEach((isWorking, dayIndex) => {
                    if (isWorking) workingDaysSet.add(dayIndex);
                });
            } else {
                // Fallback to Standard Mon-Fri if it's the Standard calendar or similar
                // But generally safe to default to Mon-Fri if nothing specified?
                // Let's stick to what's defined. If empty, it's empty (non-working).
                // EXCEPT if it is the "Standard" calendar (UID 1 often), maybe we should default?
                // Let's trust the XML.
            }
        }

        calendars.push({
            id: raw.internalId,
            name: raw.name,
            workingDays: Array.from(workingDaysSet).sort(),
            exceptions: raw.exceptions,
            workingDayOverrides: raw.workingDayOverrides
        });
    });

    // 2. Extended Attributes (Custom Fields)
    const customFieldMap = new Map<string, string>();
    root.querySelectorAll("ExtendedAttributes > ExtendedAttribute").forEach(def => {
        const fieldId = def.querySelector("FieldID")?.textContent;
        const alias = def.querySelector("Alias")?.textContent;
        const name = def.querySelector("FieldName")?.textContent;
        if (fieldId && (alias || name)) {
            customFieldMap.set(fieldId, alias || name || "");
        }
    });

    // 3. Resources
    const resources: Resource[] = [];
    const resourceMap = new Map<string, string>();

    root.querySelectorAll("Resources > Resource").forEach(res => {
        const uid = res.querySelector("UID")?.textContent;
        const name = res.querySelector("Name")?.textContent;
        const calendarUid = res.querySelector("CalendarUID")?.textContent;

        if (uid && name) {
            const id = generateId('res');
            resourceMap.set(uid, id);

            const calendarId = calendarUid ? uidToCalendarId.get(calendarUid) : undefined;

            resources.push({
                id,
                name,
                type: res.querySelector("Type")?.textContent === '1' ? 'Material' : 'Work',
                availability: 1,
                calendarId
            });
        }
    });

    // 4. Tasks
    const tasks: Task[] = [];
    const uidToInternalId = new Map<string, string>();
    const dateWarnings: DateWarning[] = [];

    root.querySelectorAll("Tasks > Task").forEach((t, idx) => {
        const uid = t.querySelector("UID")?.textContent;
        if (!uid) return;

        const internalId = generateId('task');
        uidToInternalId.set(uid, internalId);

        const name = t.querySelector("Name")?.textContent || "Unnamed Task";
        const startStr = t.querySelector("Start")?.textContent;
        const finishStr = t.querySelector("Finish")?.textContent;
        const durStr = t.querySelector("Duration")?.textContent || "PT0H0M0S";
        const pctStr = t.querySelector("PercentComplete")?.textContent || "0";
        const summary = t.querySelector("Summary")?.textContent === "1";
        const wbs = t.querySelector("WBS")?.textContent;
        const outlineLevel = parseInt(t.querySelector("OutlineLevel")?.textContent || "1");
        const milestone = t.querySelector("Milestone")?.textContent === "1";
        const calendarUid = t.querySelector("CalendarUID")?.textContent;

        // Duration
        let durationDays = 0;
        if (durStr.includes("H")) {
            const h = parseInt(durStr.split("H")[0].replace("PT", "") || "0");
            durationDays = h / 8;
        } else if (durStr.includes("D")) {
            const d = parseInt(durStr.split("D")[0].replace("P", "") || "0");
            durationDays = d;
        }

        // Custom fields
        let activityId = "";
        let activityStatus = "";
        let customText: Record<string, string> = {};

        t.querySelectorAll("ExtendedAttribute").forEach(ea => {
            const fieldId = ea.querySelector("FieldID")?.textContent;
            const val = ea.querySelector("Value")?.textContent;
            if (fieldId && val) {
                const alias = customFieldMap.get(fieldId)?.toLowerCase() || "";
                if (alias.includes("activity id")) activityId = val;
                else if (alias.includes("status") || alias.includes("activity status")) activityStatus = val;
                else customText[alias || `Field ${fieldId}`] = val;
            }
        });

        // Parse dates with validation
        const start = startStr ? new Date(startStr) : null;
        const finish = finishStr ? new Date(finishStr) : null;

        if (startStr && (!start || isNaN(start.getTime()))) {
            dateWarnings.push({ taskIndex: idx, taskName: name, field: "Start", rawValue: startStr, parsedAs: null, issue: "unparseable" });
        }
        if (finishStr && (!finish || isNaN(finish.getTime()))) {
            dateWarnings.push({ taskIndex: idx, taskName: name, field: "Finish", rawValue: finishStr, parsedAs: null, issue: "unparseable" });
        }
        if (start && finish && start > finish && !milestone) {
            dateWarnings.push({ taskIndex: idx, taskName: name, field: "Start/Finish", rawValue: `${startStr} → ${finishStr}`, parsedAs: start, issue: "start_after_finish" });
        }

        const task: Task = {
            id: internalId,
            name,
            start: start && !isNaN(start.getTime()) ? start : new Date(),
            finish: finish && !isNaN(finish.getTime()) ? finish : new Date(),
            duration: durationDays,
            percentComplete: parseInt(pctStr),
            isSummary: summary,
            isMilestone: milestone,
            level: outlineLevel - 1,
            wbs: wbs || "",
            parentId: null,
            activityId: activityId || undefined,
            status: activityStatus || (parseInt(pctStr) === 100 ? "Completed" : "Active"),
            customText: Object.keys(customText).length > 0 ? customText : undefined,
            calendarId: calendarUid ? uidToCalendarId.get(calendarUid) : undefined
        };

        tasks.push(task);
    });

    // 5. Hierarchy
    const stack: Task[] = [];
    tasks.forEach(task => {
        while (stack.length > 0 && stack[stack.length - 1].level >= task.level) stack.pop();
        if (stack.length > 0) task.parentId = stack[stack.length - 1].id;
        stack.push(task);
    });

    // 6. Links
    const links: Link[] = [];
    root.querySelectorAll("Tasks > Task").forEach(t => {
        const taskUid = t.querySelector("UID")?.textContent;
        if (!taskUid) return;
        const targetId = uidToInternalId.get(taskUid);
        if (!targetId) return;

        t.querySelectorAll("PredecessorLink").forEach(pred => {
            const predUid = pred.querySelector("PredecessorUID")?.textContent;
            const typeCode = pred.querySelector("Type")?.textContent;
            if (predUid) {
                const sourceId = uidToInternalId.get(predUid);
                if (sourceId) {
                    let type: LinkType = 'FS';
                    if (typeCode === '3') type = 'SS';
                    if (typeCode === '0') type = 'FF';
                    if (typeCode === '2') type = 'SF';
                    links.push({ id: generateId('link'), source: sourceId, target: targetId, type, lag: 0 });
                }
            }
        });
    });

    // 7. Assignments
    const assignments: Assignment[] = [];
    root.querySelectorAll("Assignments > Assignment").forEach(asn => {
        const taskUid = asn.querySelector("TaskUID")?.textContent;
        const resUid = asn.querySelector("ResourceUID")?.textContent;
        const units = asn.querySelector("Units")?.textContent;
        if (taskUid && resUid) {
            const taskId = uidToInternalId.get(taskUid);
            const resId = resourceMap.get(resUid);
            if (taskId && resId) {
                assignments.push({
                    id: generateId('asn'), taskId, resourceId: resId,
                    units: units ? parseFloat(units) * 100 : 100
                });
            }
        }
    });

    return {
        name: projectName,
        tasks, links, resources, assignments,
        calendars,
        sourceFormat: "XML/MSPDI",
        dateWarnings: dateWarnings.length > 0 ? dateWarnings : undefined,
        stats: computeStats(tasks, dateWarnings),
    };
}

// ─────────────────────────────────────────────────────────
// EXCEL PARSER (placeholder)
// ─────────────────────────────────────────────────────────

export async function parseProjectExcel(buffer: ArrayBuffer): Promise<ImportedProjectData> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json<any>(sheet);

    return {
        name: "Excel Import",
        tasks: [], links: [], resources: [], assignments: [], calendars: []
    };
}

// ─────────────────────────────────────────────────────────
// STATS HELPER
// ─────────────────────────────────────────────────────────

export function computeStats(tasks: Task[], dateWarnings: DateWarning[]): ImportedProjectData['stats'] {
    const validDates = tasks
        .flatMap(t => [t.start, t.finish])
        .filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()));

    const tasksWithDates = tasks.filter(t =>
        t.start instanceof Date && !isNaN(t.start.getTime()) &&
        t.finish instanceof Date && !isNaN(t.finish.getTime())
    ).length;

    return {
        totalTasks: tasks.length,
        milestones: tasks.filter(t => t.isMilestone).length,
        summaryTasks: tasks.filter(t => t.isSummary).length,
        tasksWithDates,
        tasksWithMissingDates: tasks.length - tasksWithDates,
        dateWarningCount: dateWarnings.length,
        minDate: validDates.length > 0 ? new Date(Math.min(...validDates.map(d => d.getTime()))) : null,
        maxDate: validDates.length > 0 ? new Date(Math.max(...validDates.map(d => d.getTime()))) : null,
    };
}
