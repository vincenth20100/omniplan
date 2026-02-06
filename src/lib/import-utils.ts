import { Task, Link, Resource, Assignment, Calendar, LinkType } from './types';

export interface ImportedProjectData {
    name: string;
    tasks: Task[];
    links: Link[];
    resources: Resource[];
    assignments: Assignment[];
    calendars: Calendar[];
}

function generateId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

// --- MS Project XML Parser ---

export function parseProjectXML(xmlContent: string): ImportedProjectData {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

    // Basic Project Info
    const projectName = xmlDoc.querySelector("Project > Title")?.textContent || "Imported Project";

    // Resources
    const resources: Resource[] = [];
    const resourceMap = new Map<string, string>(); // UID -> Internal ID
    const xmlResources = xmlDoc.querySelectorAll("Project > Resources > Resource");

    xmlResources.forEach(res => {
        const uid = res.querySelector("UID")?.textContent;
        const name = res.querySelector("Name")?.textContent;
        const type = res.querySelector("Type")?.textContent; // 0=Work, 1=Material

        if (uid && name) { // Skip blank resources often found in MSP
            const id = generateId('res');
            resourceMap.set(uid, id);

            resources.push({
                id,
                name,
                type: type === '1' ? 'Material' : 'Work',
                availability: 1, // Default
            });
        }
    });

    // Tasks & Links
    const tasks: Task[] = [];
    const links: Link[] = [];
    const taskMap = new Map<string, Task>(); // UID -> Task
    const xmlTasks = xmlDoc.querySelectorAll("Project > Tasks > Task");

    // First pass: Create tasks
    xmlTasks.forEach(t => {
        const uid = t.querySelector("UID")?.textContent;
        const name = t.querySelector("Name")?.textContent;
        const start = t.querySelector("Start")?.textContent;
        const finish = t.querySelector("Finish")?.textContent;
        const durationStr = t.querySelector("Duration")?.textContent; // PT8H0M0S format usually
        const percentComplete = t.querySelector("PercentComplete")?.textContent;
        const outlineLevel = t.querySelector("OutlineLevel")?.textContent;
        const summary = t.querySelector("Summary")?.textContent;
        const wbs = t.querySelector("WBS")?.textContent;
        const outlineNumber = t.querySelector("OutlineNumber")?.textContent;

        if (uid && name) {
            const id = generateId('task');

            // Parse duration (very basic approximation)
            let duration = 0;
            if (durationStr) {
                 // Format: PT8H0M0S or P1D
                 if (durationStr.includes('H')) {
                     // Extract hours. PT8H -> substring between T and H? Or just number before H.
                     // Assuming standard "PT" prefix for time.
                     const hIndex = durationStr.indexOf('H');
                     // Find where number starts. Usually after T.
                     const tIndex = durationStr.indexOf('T');
                     if (tIndex !== -1 && hIndex > tIndex) {
                         const hours = parseInt(durationStr.substring(tIndex + 1, hIndex));
                         if (!isNaN(hours)) duration = hours / 8;
                     }
                 } else if (durationStr.includes('D')) {
                      // P1D
                      const dIndex = durationStr.indexOf('D');
                      const pIndex = durationStr.indexOf('P');
                      if (dIndex > pIndex) {
                          const days = parseInt(durationStr.substring(pIndex + 1, dIndex));
                           if (!isNaN(days)) duration = days;
                      }
                 }
            }

            const task: Task = {
                id,
                name,
                start: start ? new Date(start) : new Date(),
                finish: finish ? new Date(finish) : new Date(),
                duration: Math.max(0, duration),
                percentComplete: percentComplete ? parseInt(percentComplete) : 0,
                status: (percentComplete === '100') ? 'Completed' : 'Active',
                isSummary: summary === '1',
                level: outlineLevel ? parseInt(outlineLevel) - 1 : 0, // MSP starts at 1
                wbs: wbs || outlineNumber || undefined,
                // We'll set parentId in second pass or by stack if ordered.
                // Usually XML is ordered.
                parentId: null,
            };

            taskMap.set(uid, task);
            tasks.push(task);

            // Links (Predecessors)
            const predecessors = t.querySelectorAll("PredecessorLink");
            predecessors.forEach(pred => {
                const predUid = pred.querySelector("PredecessorUID")?.textContent;
                const typeCode = pred.querySelector("Type")?.textContent;
                // MSP XML Link Types:
                // 0 = FF
                // 1 = FS
                // 2 = SF
                // 3 = SS

                let linkType: LinkType = 'FS'; // Default (1)
                if (typeCode === '0') linkType = 'FF';
                if (typeCode === '2') linkType = 'SF';
                if (typeCode === '3') linkType = 'SS';

                if (predUid) {
                    links.push({
                        id: generateId('link'),
                        source: predUid, // Placeholder, will replace with real ID later
                        target: id,
                        type: linkType,
                        lag: 0
                    });
                }
            });
        }
    });

    // Fixup Link IDs and Task Hierarchy
    const validLinks: Link[] = [];
    links.forEach(l => {
        const sourceTask = taskMap.get(l.source); // l.source was uid
        if (sourceTask) {
            validLinks.push({ ...l, source: sourceTask.id });
        }
    });

    // Fix hierarchy (parentId)
    // Assuming tasks are in order.
    // We can use a stack based on level.
    const stack: Task[] = [];
    tasks.forEach(task => {
        const level = task.level || 0;

        if (level === 0) {
            stack.length = 0;
            stack.push(task);
        } else {
            // Find parent
            while (stack.length > 0 && (stack[stack.length - 1].level || 0) >= level) {
                stack.pop();
            }
            if (stack.length > 0) {
                task.parentId = stack[stack.length - 1].id;
            }
            stack.push(task);
        }
    });

    // Assignments
    const assignments: Assignment[] = [];
    const xmlAssignments = xmlDoc.querySelectorAll("Project > Assignments > Assignment");
    xmlAssignments.forEach(a => {
        const taskUid = a.querySelector("TaskUID")?.textContent;
        const resUid = a.querySelector("ResourceUID")?.textContent;
        const units = a.querySelector("Units")?.textContent; // 1.0 = 100%

        if (taskUid && resUid) {
            const task = taskMap.get(taskUid);
            const resId = resourceMap.get(resUid);

            if (task && resId) {
                assignments.push({
                    id: generateId('asn'),
                    taskId: task.id,
                    resourceId: resId,
                    units: units ? parseFloat(units) * 100 : 100
                });
            }
        }
    });

    return {
        name: projectName,
        tasks,
        links: validLinks,
        resources,
        assignments,
        calendars: [] // TODO: Parse calendars if needed
    };
}


// --- Primavera P6 XER Parser ---

interface XERTable {
    name: string;
    fields: string[];
    rows: Record<string, string>[];
}

export function parsePrimaveraXER(xerContent: string): ImportedProjectData {
    const lines = xerContent.split(/\r?\n/);
    const tables: Record<string, XERTable> = {};

    let currentTable: XERTable | null = null;

    lines.forEach(line => {
        if (line.startsWith('%T')) {
            const tableName = line.split('\t')[1]?.trim();
            if (tableName) {
                currentTable = { name: tableName, fields: [], rows: [] };
                tables[tableName] = currentTable;
            }
        } else if (line.startsWith('%F') && currentTable) {
            const fields = line.split('\t').slice(1).map(f => f.trim());
            currentTable.fields = fields;
        } else if (line.startsWith('%R') && currentTable) {
            const values = line.split('\t').slice(1);
            const row: Record<string, string> = {};
            currentTable.fields.forEach((field, index) => {
                row[field] = values[index]; // Note: values might be sparse or contain quotes? XER is usually plain tab separated.
            });
            currentTable.rows.push(row);
        }
    });

    // Extract Data
    // We assume single project import for now, or take the first one found in PROJECT table if exists?
    // Usually XER can contain multiple projects.
    // For simplicity, we import everything linked to the tasks found.

    const projectTable = tables['PROJECT'];
    const projectName = projectTable?.rows[0]?.['proj_short_name'] || "Imported XER Project";

    // Resources
    const resources: Resource[] = [];
    const resourceMap = new Map<string, string>(); // rsrc_id -> Internal ID
    const rsrcTable = tables['RSRC'];

    if (rsrcTable) {
        rsrcTable.rows.forEach(row => {
            const id = generateId('res');
            resourceMap.set(row['rsrc_id'], id);
            resources.push({
                id,
                name: row['rsrc_name'] || row['rsrc_short_name'] || 'Unnamed Resource',
                type: 'Work', // Default
                availability: 1
            });
        });
    }

    // WBS (for hierarchy)
    const wbsMap = new Map<string, { parentWbsId: string, name: string, internalId: string }>();
    const wbsTable = tables['PROJWBS'];

    // Map WBS ID to info
    if (wbsTable) {
        wbsTable.rows.forEach(row => {
             // We can treat WBS nodes as Summary Tasks if we want full structure.
             // But usually tasks link to a WBS.
             // Let's create a map to reconstruct hierarchy for tasks.
             wbsMap.set(row['wbs_id'], {
                 parentWbsId: row['parent_wbs_id'],
                 name: row['wbs_name'],
                 internalId: generateId('wbs') // We might create dummy summary tasks for WBS nodes later?
             });
        });
    }

    // Tasks
    const tasks: Task[] = [];
    const taskMap = new Map<string, Task>(); // task_id -> Task
    const taskTable = tables['TASK'];

    if (taskTable) {
        taskTable.rows.forEach(row => {
            const id = generateId('task');
            const start = row['target_start_date'] ? new Date(row['target_start_date']) : new Date();
            const finish = row['target_end_date'] ? new Date(row['target_end_date']) : new Date();
            const durationHrs = parseFloat(row['target_drtn_hr_cnt'] || '0');

            // XER dates are often "yyyy-mm-dd hh:mm"

            const task: Task = {
                id,
                name: row['task_name'] || row['task_code'] || 'Unnamed Task',
                start,
                finish,
                duration: durationHrs / 8, // Assuming 8h days
                percentComplete: 0, // Need to find field, maybe 'act_work_qty' / 'target_work_qty'? or 'phys_complete_pct'
                status: row['status_code'] === 'TK_Active' ? 'Active' : (row['status_code'] === 'TK_Done' ? 'Completed' : 'Active'),
                wbs: row['wbs_id'], // Store raw WBS ID for now
                parentId: null, // Will resolve
                isSummary: false, // Default
            };

            taskMap.set(row['task_id'], task);
            tasks.push(task);
        });
    }

    // Resolve Hierarchy via WBS
    // This is tricky. P6 has WBS nodes and Tasks are children of WBS nodes.
    // WBS nodes form a tree.
    // If we want to represent this in a simple Task list with parentId, we should probably
    // create "Summary Tasks" for each WBS node used.

    // 1. Identify used WBS nodes or just all WBS nodes for this project.
    // 2. Build WBS tree.
    // 3. Assign Tasks to WBS nodes.

    const wbsNodes: Task[] = [];
    const wbsIdToTaskMap = new Map<string, Task>();

    if (wbsTable) {
        wbsTable.rows.forEach(row => {
            const wbs = wbsMap.get(row['wbs_id']);
            if (wbs) {
                // Create a summary task for this WBS
                const task: Task = {
                    id: wbs.internalId,
                    name: wbs.name,
                    start: new Date(), // Will calculate rollups or default
                    finish: new Date(),
                    duration: 0,
                    percentComplete: 0,
                    status: 'Active',
                    isSummary: true,
                    parentId: null, // Will resolve
                    wbs: row['wbs_short_name'] // Display WBS code
                };
                wbsNodes.push(task);
                wbsIdToTaskMap.set(row['wbs_id'], task);
            }
        });

        // Link WBS nodes
        wbsNodes.forEach(node => {
            // Find raw WBS row to get parent
             const row = wbsTable.rows.find(r => r['wbs_name'] === node.name); // Inefficient search, but ID is better
             // Better: iterate wbsMap
        });

        // Re-iterate via wbsMap keys
        for (const [wbsId, info] of wbsMap.entries()) {
            const nodeTask = wbsIdToTaskMap.get(wbsId);
            if (nodeTask && info.parentWbsId) {
                const parentTask = wbsIdToTaskMap.get(info.parentWbsId);
                if (parentTask) {
                    nodeTask.parentId = parentTask.id;
                }
            }
        }
    }

    // Link Tasks to WBS Nodes
    tasks.forEach(task => {
        if (task.wbs) {
            const parentWbs = wbsIdToTaskMap.get(task.wbs);
            if (parentWbs) {
                task.parentId = parentWbs.id;
            }
            task.wbs = undefined; // Clear raw ID
        }
    });

    // Combine WBS nodes and Tasks
    const allTasks = [...wbsNodes, ...tasks];

    // Links
    const links: Link[] = [];
    const predTable = tables['TASKPRED'];
    if (predTable) {
        predTable.rows.forEach(row => {
            const predTask = taskMap.get(row['pred_task_id']);
            const succTask = taskMap.get(row['task_id']);
            const type = row['pred_type']; // 'PR_FS', 'PR_SS', etc.

            if (predTask && succTask) {
                let linkType: LinkType = 'FS';
                if (type === 'PR_SS') linkType = 'SS';
                if (type === 'PR_FF') linkType = 'FF';
                if (type === 'PR_SF') linkType = 'SF';

                links.push({
                    id: generateId('link'),
                    source: predTask.id,
                    target: succTask.id,
                    type: linkType,
                    lag: parseFloat(row['lag_hr_cnt'] || '0') / 8
                });
            }
        });
    }

    // Assignments
    const assignments: Assignment[] = [];
    const taskRsrcTable = tables['TASKRSRC'];
    if (taskRsrcTable) {
         taskRsrcTable.rows.forEach(row => {
             const task = taskMap.get(row['task_id']);
             const rsrcId = resourceMap.get(row['rsrc_id']);

             if (task && rsrcId) {
                 assignments.push({
                     id: generateId('asn'),
                     taskId: task.id,
                     resourceId: rsrcId,
                     units: 100 // Default, or parse 'target_qty'
                 });
             }
         });
    }

    return {
        name: projectName,
        tasks: allTasks,
        links,
        resources,
        assignments,
        calendars: []
    };
}
