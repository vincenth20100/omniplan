/**
 * import-utils.ts
 *
 * Type definitions for project import data, plus client-side parsers
 * for XML and Excel files. Binary/proprietary formats (.mpp, .xer, .mpx, etc.)
 * are handled server-side by omniplan-utils.ts → HF Space.
 *
 * ────────────────────────────────────────────────────────────────────
 * IMPORTANT: If you already have parseProjectXML / parseProjectExcel /
 * parsePrimaveraXER implemented, keep your existing logic and just
 * update the type definitions below to match.
 * ────────────────────────────────────────────────────────────────────
 */

// ═════════════════════════════════════════════════════════
//  TYPE DEFINITIONS
// ═════════════════════════════════════════════════════════

export interface ImportedTask {
  // Core (required)
  id: string;
  name: string;
  start: Date;
  finish: Date;
  duration: number;                // days

  // Structure
  outlineId?: string;
  wbs?: string;
  outlineLevel?: number;

  // Progress
  percentComplete?: number;

  // Flags
  isMilestone?: boolean;
  isSummary?: boolean;
  isCritical?: boolean;

  // Work & cost
  work?: string;
  cost?: string;

  // Relationships (display strings)
  resources?: string;              // comma-separated names
  predecessors?: string;           // e.g. "1(FS); 3(SS)"

  // Constraints
  constraintType?: string;
  constraintDate?: string;
  deadline?: string;
  notes?: string;

  // Baseline
  baselineStart?: Date;
  baselineFinish?: Date;
  baselineDuration?: number;
  priority?: string;

  // P6-specific (populated when source is XER / PMXML)
  activityId?: string;
  activityType?: string;
  remainingDuration?: number;
  actualDuration?: number;
  actualStart?: Date;
  actualFinish?: Date;
  calendar?: string;

  // Custom fields
  customText?: Record<string, string>;
  customNumbers?: Record<string, string>;
  customDates?: Record<string, string>;
  customFlags?: Record<string, string>;
}

export interface ImportedResource {
  id: string;
  name: string;
  type?: string;
  initials?: string;
  group?: string;
  email?: string;
  maxUnits?: string;
  standardRate?: string;
  overtimeRate?: string;
  work?: string;
  cost?: string;
  calendar?: string;
  notes?: string;
}

export interface ImportedAssignment {
  taskId: string;
  taskName: string;
  resourceId: string;
  resourceName: string;
  units?: string;
  work?: string;
  start?: string;
  finish?: string;
  cost?: string;
}

export interface ImportedDependency {
  taskId: string;
  taskName: string;
  predecessorId: string;
  predecessorName: string;
  type: string;                    // FS, SS, FF, SF
  lag: string;
}

export interface ImportedCalendar {
  name: string;
  uniqueId: string;
  type?: string;
  parentCalendar?: string;
  exceptions?: string;
}

export interface ImportedActivityCode {
  codeName: string;
  value: string;
  description: string;
}

export interface ImportedProjectData {
  name: string;
  tasks: ImportedTask[];
  resources: ImportedResource[];

  // Extended (populated by HF Space service; optional for local parsers)
  assignments?: ImportedAssignment[];
  dependencies?: ImportedDependency[];
  calendars?: ImportedCalendar[];
  activityCodes?: ImportedActivityCode[];
  projectInfo?: Record<string, string | undefined>;
  sourceFormat?: string;
}


// ═════════════════════════════════════════════════════════
//  CLIENT-SIDE PARSERS (keep your existing implementations)
// ═════════════════════════════════════════════════════════

/**
 * Parse MS Project XML (MSPDI) from a string.
 * This runs entirely client-side — no server call needed.
 *
 * Replace the body below with your existing parseProjectXML if you
 * already have one.
 */
export function parseProjectXML(xmlText: string): ImportedProjectData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");

  // Detect namespace
  const root = doc.documentElement;
  const ns = root.namespaceURI || "";

  const getTag = (el: Element, tag: string): string => {
    const child = ns
      ? el.getElementsByTagNameNS(ns, tag)[0]
      : el.getElementsByTagName(tag)[0];
    return child?.textContent?.trim() ?? "";
  };

  // Project name
  const projectName =
    getTag(root, "Name") ||
    getTag(root, "Title") ||
    "Imported Project";

  // Tasks
  const taskEls = ns
    ? root.getElementsByTagNameNS(ns, "Task")
    : root.getElementsByTagName("Task");

  const tasks: ImportedTask[] = [];
  for (let i = 0; i < taskEls.length; i++) {
    const t = taskEls[i];
    const name = getTag(t, "Name");
    if (!name) continue;

    const start = new Date(getTag(t, "Start") || Date.now());
    const finish = new Date(getTag(t, "Finish") || Date.now());
    const durStr = getTag(t, "Duration"); // PT120H0M0S format

    let duration = 0;
    const durMatch = durStr.match(/PT(\d+)H/);
    if (durMatch) {
      duration = parseInt(durMatch[1], 10) / 8; // hours → days
    } else {
      duration = Math.max(0, (finish.getTime() - start.getTime()) / 86_400_000);
    }

    const pctStr = getTag(t, "PercentComplete");
    const percentComplete = pctStr ? parseInt(pctStr, 10) : 0;

    const wbs = getTag(t, "WBS");
    const outlineLevel = parseInt(getTag(t, "OutlineLevel") || "0", 10);
    const isMilestone = getTag(t, "Milestone") === "1";
    const isSummary = getTag(t, "Summary") === "1";

    tasks.push({
      id: getTag(t, "UID") || String(i),
      outlineId: getTag(t, "ID"),
      name,
      wbs,
      outlineLevel,
      start,
      finish,
      duration,
      percentComplete,
      isMilestone,
      isSummary,
      notes: getTag(t, "Notes"),
    });
  }

  // Resources
  const resEls = ns
    ? root.getElementsByTagNameNS(ns, "Resource")
    : root.getElementsByTagName("Resource");

  const resources: ImportedResource[] = [];
  for (let i = 0; i < resEls.length; i++) {
    const r = resEls[i];
    const name = getTag(r, "Name");
    if (!name) continue;
    resources.push({
      id: getTag(r, "UID") || String(i),
      name,
      type: getTag(r, "Type"),
      initials: getTag(r, "Initials"),
      group: getTag(r, "Group"),
      email: getTag(r, "EmailAddress"),
      standardRate: getTag(r, "StandardRate"),
    });
  }

  return {
    name: projectName,
    tasks,
    resources,
    sourceFormat: "XML",
  };
}


/**
 * Parse Primavera XER text file client-side.
 *
 * NOTE: This is a basic parser. For full P6 fidelity (activity codes,
 * relationships, calendars, WBS hierarchy, etc.), use the HF Space
 * service instead — it uses mpxj which handles XER comprehensively.
 *
 * The import-dialog.tsx now routes .xer files through the HF Space by
 * default, so this function is only used as a fallback.
 */
export function parsePrimaveraXER(text: string): ImportedProjectData {
  const lines = text.split("\n").map(l => l.trimEnd());
  const tables: Record<string, { headers: string[]; rows: string[][] }> = {};

  let currentTable = "";
  let currentHeaders: string[] = [];

  for (const line of lines) {
    if (line.startsWith("%T\t")) {
      currentTable = line.split("\t")[1] ?? "";
      currentHeaders = [];
    } else if (line.startsWith("%F\t")) {
      currentHeaders = line.split("\t").slice(1);
    } else if (line.startsWith("%R\t") && currentTable && currentHeaders.length) {
      if (!tables[currentTable]) {
        tables[currentTable] = { headers: currentHeaders, rows: [] };
      }
      tables[currentTable].rows.push(line.split("\t").slice(1));
    }
  }

  const col = (tbl: string, row: string[], name: string): string => {
    const idx = tables[tbl]?.headers.indexOf(name) ?? -1;
    return idx >= 0 ? (row[idx] ?? "") : "";
  };

  // Project name
  const projTable = tables["PROJECT"] ?? tables["PROJWBS"];
  const projectName =
    projTable?.rows[0]
      ? col("PROJECT", projTable.rows[0], "proj_short_name") || "P6 Import"
      : "P6 Import";

  // Tasks from TASK table
  const taskTable = tables["TASK"];
  const tasks: ImportedTask[] = [];
  if (taskTable) {
    for (const row of taskTable.rows) {
      const name = col("TASK", row, "task_name");
      if (!name) continue;

      const start = new Date(col("TASK", row, "act_start_date") || col("TASK", row, "early_start_date") || Date.now());
      const finish = new Date(col("TASK", row, "act_end_date") || col("TASK", row, "early_end_date") || Date.now());
      const dur = Math.max(0, (finish.getTime() - start.getTime()) / 86_400_000);

      tasks.push({
        id: col("TASK", row, "task_id") || String(tasks.length),
        name,
        start,
        finish,
        duration: dur,
        activityId: col("TASK", row, "task_code"),
        activityType: col("TASK", row, "task_type"),
        percentComplete: parseFloat(col("TASK", row, "phys_complete_pct") || "0") || 0,
      });
    }
  }

  // Resources from RSRC table
  const rsrcTable = tables["RSRC"];
  const resources: ImportedResource[] = [];
  if (rsrcTable) {
    for (const row of rsrcTable.rows) {
      const name = col("RSRC", row, "rsrc_name");
      if (!name) continue;
      resources.push({
        id: col("RSRC", row, "rsrc_id") || String(resources.length),
        name,
        type: col("RSRC", row, "rsrc_type"),
        email: col("RSRC", row, "email_addr"),
      });
    }
  }

  return {
    name: projectName,
    tasks,
    resources,
    sourceFormat: "Primavera P6 XER (client-parsed)",
  };
}


/**
 * Parse Excel / CSV buffer into ImportedProjectData.
 *
 * Expects columns like: Name/Task Name, Start, Finish, Duration, etc.
 * Replace with your existing implementation.
 */
export async function parseProjectExcel(buffer: ArrayBuffer): Promise<ImportedProjectData> {
  // Dynamic import so the bundle doesn't ship xlsx to everyone
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });

  // Use first sheet
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

  if (rows.length === 0) {
    return { name: "Excel Import", tasks: [], resources: [] };
  }

  // Auto-detect column names (case-insensitive)
  const headers = Object.keys(rows[0]);
  const find = (...candidates: string[]): string | undefined =>
    headers.find(h => candidates.some(c => h.toLowerCase().includes(c.toLowerCase())));

  const nameCol    = find("Task Name", "Name", "Activity Name", "Activity");
  const startCol   = find("Start", "Start Date", "Planned Start", "Early Start");
  const finishCol  = find("Finish", "End", "End Date", "Finish Date", "Planned Finish", "Early Finish");
  const durCol     = find("Duration", "Dur");
  const pctCol     = find("% Complete", "Percent", "Complete");
  const wbsCol     = find("WBS", "Outline");
  const idCol      = find("ID", "Task ID", "Activity ID");

  const tasks: ImportedTask[] = rows
    .filter(r => nameCol && r[nameCol])
    .map((r, i) => {
      const start  = startCol && r[startCol] instanceof Date ? r[startCol] : new Date(r[startCol!] || Date.now());
      const finish = finishCol && r[finishCol] instanceof Date ? r[finishCol] : new Date(r[finishCol!] || Date.now());
      const durRaw = durCol ? r[durCol] : null;
      let duration = typeof durRaw === "number" ? durRaw : parseFloat(String(durRaw)) || 0;
      if (duration === 0) {
        duration = Math.max(0, (finish.getTime() - start.getTime()) / 86_400_000);
      }

      return {
        id: idCol ? String(r[idCol]) : String(i),
        name: String(r[nameCol!]),
        wbs: wbsCol ? String(r[wbsCol]) : undefined,
        start,
        finish,
        duration,
        percentComplete: pctCol ? parseFloat(String(r[pctCol])) || 0 : 0,
      };
    });

  return {
    name: "Excel Import",
    tasks,
    resources: [],
    sourceFormat: "Excel",
  };
}
