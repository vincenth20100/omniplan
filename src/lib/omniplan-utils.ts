import { ImportedProjectData } from './import-utils';
import { Task, Resource, Assignment, Link, LinkType } from './types';

const API_URL = process.env.NEXT_PUBLIC_OMNIPLAN_API_URL || 'https://vincentheloin-omniplan-converter.hf.space';

interface OmniPlanTask {
    ID: number;
    Name: string;
    Duration: string; // "8 hours", "1 day" etc.
    Start: string; // "Mon Jan 15 08:00:00 UTC 2024"
    Finish: string;
    "% Complete": number;
    "Resource Names": string; // "Res1, Res2"
    "Predecessors"?: string; // "2FS+2d"
    OutlineLevel?: number;
}

interface OmniPlanResource {
    ID: number;
    Name: string;
    Type: string;
}

interface OmniPlanAssignment {
    TaskID: number;
    ResourceID: number;
    Units: number;
}

interface OmniPlanAnalysisResult {
    project_info: {
        Title: string;
        "Start Date": string;
        "Finish Date": string;
    };
    tasks: OmniPlanTask[];
    resources?: OmniPlanResource[];
    assignments?: OmniPlanAssignment[];
}

function parseOmniDate(dateStr: string): Date {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        console.warn("Failed to parse date:", dateStr);
        return new Date();
    }
    return date;
}

function parseDuration(durationStr: string): number {
    if (!durationStr) return 0;
    const str = String(durationStr).toLowerCase();
    const val = parseFloat(str);
    if (isNaN(val)) return 0;

    if (str.includes('h')) return val / 8; // Assuming 8h day
    if (str.includes('w')) return val * 5;
    // P6 or MSP XML might give "PT8H". But here the prompt suggests human readable or CSV-like.
    // If just number, assume days.
    return val;
}

function generateId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function analyzeProjectFile(file: File): Promise<ImportedProjectData> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        let errorMsg = response.statusText;
        try {
            const errBody = await response.json();
            if (errBody.error) errorMsg = errBody.error;
        } catch (e) {}
        throw new Error(`Analysis failed: ${errorMsg}`);
    }

    const data: OmniPlanAnalysisResult = await response.json();

    const tasks: Task[] = [];
    const resources: Resource[] = [];
    const assignments: Assignment[] = [];
    const links: Link[] = [];

    // Map Resources
    const resourceMap = new Map<string, string>(); // Name -> Internal ID
    const resourceIdMap = new Map<number, string>(); // Omni ID -> Internal ID

    if (data.resources) {
        data.resources.forEach(r => {
             const id = generateId('res');
             resourceMap.set(r.Name, id);
             resourceIdMap.set(r.ID, id);
             resources.push({
                 id,
                 name: r.Name,
                 type: r.Type === 'Material' ? 'Material' : 'Work',
                 availability: 1
             });
        });
    }

    // Map Tasks
    const taskIdMap = new Map<number, string>(); // Omni ID -> Internal ID

    data.tasks.forEach(t => {
        const id = generateId('task');
        taskIdMap.set(t.ID, id);

        const task: Task = {
            id,
            name: t.Name,
            start: parseOmniDate(t.Start),
            finish: parseOmniDate(t.Finish),
            duration: parseDuration(t.Duration),
            percentComplete: t["% Complete"] || 0,
            status: (t["% Complete"] === 100) ? 'Completed' : 'Active',
            isSummary: false, // Will resolve from hierarchy
            level: t.OutlineLevel ? t.OutlineLevel - 1 : 0,
            parentId: null
        };
        tasks.push(task);

        // Handle Resource Names if resources were not provided explicitly
        if (t["Resource Names"]) {
            const names = t["Resource Names"].split(',').map(s => s.trim());
            names.forEach(name => {
                if (!name) return;
                let resId = resourceMap.get(name);
                if (!resId) {
                     // Create new if not exists
                     resId = generateId('res');
                     resourceMap.set(name, resId);
                     resources.push({
                         id: resId,
                         name: name,
                         type: 'Work',
                         availability: 1
                     });
                }

                // Avoid duplicates if assignments are also provided explicitly
                const alreadyAssigned = assignments.some(a => a.taskId === id && a.resourceId === resId);
                if (!alreadyAssigned) {
                    assignments.push({
                        id: generateId('asn'),
                        taskId: id,
                        resourceId: resId!,
                        units: 100
                    });
                }
            });
        }
    });

    // Assignments from explicit list if available
    if (data.assignments) {
        data.assignments.forEach(a => {
            const taskId = taskIdMap.get(a.TaskID);
            const resId = resourceIdMap.get(a.ResourceID);
            if (taskId && resId) {
                const exists = assignments.some(exist => exist.taskId === taskId && exist.resourceId === resId);
                if (!exists) {
                    assignments.push({
                        id: generateId('asn'),
                        taskId,
                        resourceId: resId,
                        units: a.Units * 100
                    });
                }
            }
        });
    }

    // Hierarchy (Parent/Child)
    const stack: Task[] = [];
    tasks.forEach(task => {
        const level = task.level || 0;
        if (level === 0) {
            stack.length = 0;
            stack.push(task);
        } else {
             while (stack.length > 0 && (stack[stack.length - 1].level || 0) >= level) {
                stack.pop();
            }
            if (stack.length > 0) {
                task.parentId = stack[stack.length - 1].id;
                stack[stack.length - 1].isSummary = true;
            }
            stack.push(task);
        }
    });

    // Predecessors (Links)
    data.tasks.forEach(t => {
        const targetId = taskIdMap.get(t.ID);
        if (t.Predecessors && targetId) {
            const preds = t.Predecessors.toString().split(',');
            preds.forEach(p => {
                const trimmed = p.trim();
                // Parse "IDType+Lag" e.g. "12FS", "3", "4SS+2d"
                const match = trimmed.match(/^(\d+)(FS|SS|FF|SF)?/i);
                if (match) {
                     const sourceOmniId = parseInt(match[1]);
                     const typeStr = (match[2] || 'FS').toUpperCase();
                     let linkType: LinkType = 'FS';
                     if (['FS', 'SS', 'FF', 'SF'].includes(typeStr)) {
                         linkType = typeStr as LinkType;
                     }

                     const sourceId = taskIdMap.get(sourceOmniId);

                     if (sourceId) {
                         links.push({
                             id: generateId('link'),
                             source: sourceId,
                             target: targetId,
                             type: linkType,
                             lag: 0
                         });
                     }
                }
            });
        }
    });

    return {
        name: data.project_info.Title || file.name,
        tasks,
        resources,
        assignments,
        links,
        calendars: []
    };
}

export async function convertProjectFile(file: File, format: 'json' | 'xml' | 'xlsx'): Promise<Blob> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', format);

    const response = await fetch(`${API_URL}/convert`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        let errorMsg = response.statusText;
        try {
            const errBody = await response.json();
            if (errBody.error) errorMsg = errBody.error;
        } catch (e) {}
        throw new Error(`Conversion failed: ${errorMsg}`);
    }

    return await response.blob();
}
