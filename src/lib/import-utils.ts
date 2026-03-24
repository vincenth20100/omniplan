import { Task, Link, Resource, Assignment, Calendar, LinkType } from './types';

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

export interface ActivityCode {
    codeName: string;
    description: string;
    value: string;
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
    activityCodes?: ActivityCode[];       // P6 activity code definitions
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

export function parseProjectXML(xmlContent: string): ImportedProjectData {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

    const root = xmlDoc.querySelector("Project");
    if (!root) throw new Error("Invalid XML: Missing <Project> tag");

    const projectName = root.querySelector("Title")?.textContent || "Imported Project";

    // 1. Extended Attributes (Custom Fields)
    const customFieldMap = new Map<string, string>();
    root.querySelectorAll("ExtendedAttributes > ExtendedAttribute").forEach(def => {
        const fieldId = def.querySelector("FieldID")?.textContent;
        const alias = def.querySelector("Alias")?.textContent;
        const name = def.querySelector("FieldName")?.textContent;
        if (fieldId && (alias || name)) {
            customFieldMap.set(fieldId, alias || name || "");
        }
    });

    // 2. Resources
    const resources: Resource[] = [];
    const resourceMap = new Map<string, string>();

    root.querySelectorAll("Resources > Resource").forEach(res => {
        const uid = res.querySelector("UID")?.textContent;
        const name = res.querySelector("Name")?.textContent;
        if (uid && name) {
            const id = generateId('res');
            resourceMap.set(uid, id);
            resources.push({
                id,
                name,
                type: res.querySelector("Type")?.textContent === '1' ? 'Material' : 'Work',
                availability: 1,
            });
        }
    });

    // 3. Tasks
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
            customText: Object.keys(customText).length > 0 ? customText : undefined
        };

        tasks.push(task);
    });

    // 4. Hierarchy
    const stack: Task[] = [];
    tasks.forEach(task => {
        while (stack.length > 0 && (stack[stack.length - 1].level ?? 0) >= (task.level ?? 0)) stack.pop();
        if (stack.length > 0) task.parentId = stack[stack.length - 1].id;
        stack.push(task);
    });

    // 5. Links
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

    // 6. Assignments
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
        calendars: [],
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
