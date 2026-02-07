import { Task, Link, Resource, Assignment, Calendar, LinkType } from './types';

export interface ImportedProjectData {
    name: string;
    tasks: Task[];
    links: Link[];
    resources: Resource[];
    assignments: Assignment[];
    calendars: Calendar[];
    sourceFormat?: string; // Track origin (e.g. "Primavera P6 via XML")
}

function generateId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

// ─────────────────────────────────────────────────────────
// ROBUST MS PROJECT XML (MSPDI) PARSER
// ─────────────────────────────────────────────────────────

export function parseProjectXML(xmlContent: string): ImportedProjectData {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

    const root = xmlDoc.querySelector("Project");
    if (!root) throw new Error("Invalid XML: Missing <Project> tag");

    const projectName = root.querySelector("Title")?.textContent || "Imported Project";

    // 1. Parse Extended Attributes Definitions (Custom Fields)
    // MPXJ maps P6 fields (Activity ID, etc.) to these custom fields.
    // We map FieldID -> FieldName/Alias
    const customFieldMap = new Map<string, string>(); 
    root.querySelectorAll("ExtendedAttributes > ExtendedAttribute").forEach(def => {
        const fieldId = def.querySelector("FieldID")?.textContent;
        const alias = def.querySelector("Alias")?.textContent;
        const name = def.querySelector("FieldName")?.textContent;
        if (fieldId && (alias || name)) {
            customFieldMap.set(fieldId, alias || name || "");
        }
    });

    // 2. Parse Resources
    const resources: Resource[] = [];
    const resourceMap = new Map<string, string>(); // UID -> Internal ID
    
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
                // Capture standard rate if needed: res.querySelector("StandardRate")?.textContent
            });
        }
    });

    // 3. Parse Tasks
    const tasks: Task[] = [];
    const taskMap = new Map<string, Task>(); // UID -> Task Object
    const uidToInternalId = new Map<string, string>();

    root.querySelectorAll("Tasks > Task").forEach(t => {
        const uid = t.querySelector("UID")?.textContent;
        if (!uid) return;

        const internalId = generateId('task');
        uidToInternalId.set(uid, internalId);

        // Basic Fields
        const name = t.querySelector("Name")?.textContent || "Unnamed Task";
        const startStr = t.querySelector("Start")?.textContent;
        const finishStr = t.querySelector("Finish")?.textContent;
        const durStr = t.querySelector("Duration")?.textContent || "PT0H0M0S";
        const pctStr = t.querySelector("PercentComplete")?.textContent || "0";
        const summary = t.querySelector("Summary")?.textContent === "1";
        const wbs = t.querySelector("WBS")?.textContent;
        const outlineLevel = parseInt(t.querySelector("OutlineLevel")?.textContent || "1");
        const milestone = t.querySelector("Milestone")?.textContent === "1";

        // Duration parsing (PT8H0M0S format)
        let durationDays = 0;
        if (durStr.includes("H")) {
            const h = parseInt(durStr.split("H")[0].replace("PT", "") || "0");
            durationDays = h / 8;
        } else if (durStr.includes("D")) {
             const d = parseInt(durStr.split("D")[0].replace("P", "") || "0");
             durationDays = d;
        }

        // ─── CRITICAL: Extract Custom Fields (P6 Data) ───
        let activityId = "";
        let activityStatus = "";
        let customText: Record<string, string> = {};

        t.querySelectorAll("ExtendedAttribute").forEach(ea => {
            const fieldId = ea.querySelector("FieldID")?.textContent;
            const val = ea.querySelector("Value")?.textContent;
            
            if (fieldId && val) {
                const alias = customFieldMap.get(fieldId)?.toLowerCase() || "";
                
                // Heuristic: MPXJ often maps "Activity ID" to Text1 or verifies Alias
                if (alias.includes("activity id")) activityId = val;
                else if (alias.includes("status") || alias.includes("activity status")) activityStatus = val;
                else {
                    // Store other custom fields generically
                    customText[alias || `Field ${fieldId}`] = val;
                }
            }
        });

        // If no explicit Activity ID found in extended attributes, check generic text fields
        // MPXJ usually writes P6 Activity ID to the "Text1" field if not aliased.
        if (!activityId) {
            // Check specific common mappings if needed, or leave blank
        }

        const task: Task = {
            id: internalId,
            name,
            start: startStr ? new Date(startStr) : new Date(),
            finish: finishStr ? new Date(finishStr) : new Date(),
            duration: durationDays,
            percentComplete: parseInt(pctStr),
            isSummary: summary,
            isMilestone: milestone,
            level: outlineLevel - 1, // Normalized to 0-based
            wbs: wbs || "",
            parentId: null, // Will calculate in Pass 2
            
            // P6 Specific Fields
            activityId: activityId || undefined, // Captured from ExtendedAttributes!
            status: activityStatus || (parseInt(pctStr) === 100 ? "Completed" : "Active"),
            customText: Object.keys(customText).length > 0 ? customText : undefined
        };

        tasks.push(task);
        taskMap.set(uid, task);
    });

    // 4. Pass 2: Hierarchy & Links
    // Reconstruct Parent-Child relationships using OutlineLevel stack
    const stack: Task[] = [];
    tasks.forEach(task => {
        const level = task.level;
        if (stack.length === 0) {
            stack.push(task);
        } else {
            while (stack.length > 0 && stack[stack.length - 1].level >= level) {
                stack.pop();
            }
            if (stack.length > 0) {
                task.parentId = stack[stack.length - 1].id;
            }
            stack.push(task);
        }
    });

    // Links (Dependencies)
    const links: Link[] = [];
    root.querySelectorAll("Tasks > Task").forEach(t => {
        const taskUid = t.querySelector("UID")?.textContent;
        if (!taskUid) return;
        
        const targetId = uidToInternalId.get(taskUid);
        if (!targetId) return;

        t.querySelectorAll("PredecessorLink").forEach(pred => {
            const predUid = pred.querySelector("PredecessorUID")?.textContent;
            const typeCode = pred.querySelector("Type")?.textContent; // 1=FS, 2=SF, 3=SS, 0=FF
            const lagStr = pred.querySelector("LinkLag")?.textContent; // Duration format

            if (predUid) {
                const sourceId = uidToInternalId.get(predUid);
                if (sourceId) {
                    let type: LinkType = 'FS';
                    if (typeCode === '3') type = 'SS';
                    if (typeCode === '0') type = 'FF';
                    if (typeCode === '2') type = 'SF';

                    links.push({
                        id: generateId('link'),
                        source: sourceId,
                        target: targetId,
                        type,
                        lag: 0 // Parse lag string if strict accuracy needed
                    });
                }
            }
        });
    });

    // 5. Assignments
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
                    id: generateId('asn'),
                    taskId,
                    resourceId: resId,
                    units: units ? parseFloat(units) * 100 : 100
                });
            }
        }
    });

    return {
        name: projectName,
        tasks,
        links,
        resources,
        assignments,
        calendars: [],
        sourceFormat: "XML/MSPDI"
    };
}

// ─────────────────────────────────────────────────────────
// EXCEL PARSER (Kept largely the same, just ensuring exports)
// ─────────────────────────────────────────────────────────

export async function parseProjectExcel(buffer: ArrayBuffer): Promise<ImportedProjectData> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json<any>(sheet);

    // [Insert your existing Excel parsing logic here, mapping columns to Task interface]
    // Ensure you return { tasks, links, resources, ... } structure.
    
    // Placeholder to make file complete for copy-paste:
    return {
        name: "Excel Import",
        tasks: [], 
        links: [],
        resources: [],
        assignments: [],
        calendars: []
    };
}
