/**
 * omniplan-utils.ts
 *
 * Routes project files to either:
 *   - HF Space /analyze (binary files → full JSON with ALL data)
 *   - Local parsers (XML, Excel)
 *
 * The /analyze JSON IS the import data. What you preview = what you import.
 * No /convert step needed, no data loss.
 *
 * Date handling: raw server strings are preserved and validated.
 * Any parsing issues are collected in dateWarnings[] for preview review.
 */

import {
  ImportedProjectData,
  DateWarning,
  ActivityCode,
  parseProjectXML,
  parseProjectExcel,
  computeStats,
} from "./import-utils";
import { Task, Link, Resource, Assignment, Calendar, LinkType } from "./types";
import { format } from "date-fns";

// ─────────────────────────────────────────────────────────
// CONFIG
// (Client-side direct HF Space fetch removed — import now goes through /api/import)
// ─────────────────────────────────────────────────────────

export const SERVER_EXTENSIONS = new Set([
  ".mpp", ".mpt", ".mpx",
  ".xer", ".pmxml",
  ".pp", ".pod",
  ".planner", ".gan",
  ".sdef", ".fts",
  ".schedule_grid",
  ".cdpx", ".cdpz",
  ".mpd", ".mdb",
]);

// ─────────────────────────────────────────────────────────
// HF /analyze response shape
// ─────────────────────────────────────────────────────────
export interface HFAnalyzeResponse {
  project_info: Record<string, string>;
  tasks: Record<string, string>[];
  resources: Record<string, string>[];
  assignments: Record<string, string>[];
  predecessors: Record<string, string>[];
  calendars: Record<string, string>[];
  activity_codes?: Record<string, string>[];
  error?: string;
}

// ─────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────

export async function analyzeProjectFile(
  file: File
): Promise<ImportedProjectData> {
  const ext = "." + file.name.toLowerCase().split(".").pop();

  if (SERVER_EXTENSIONS.has(ext)) {
    console.log(`[Import] Routing ${ext} to /analyze for full data...`);
    return await analyzeViaServer(file);
  }

  if (ext === ".xml") {
    const text = await file.text();
    // Detect Primavera PMXML → better via server
    if (
      text.includes("<APIBusinessObjects") ||
      text.includes("P6 EPPM") ||
      text.includes("xmlns:p6")
    ) {
      console.log("[Import] Detected Primavera PMXML → routing to /analyze...");
      return await analyzeViaServer(file);
    }
    return parseProjectXML(text);
  }

  if (ext === ".xlsx" || ext === ".csv") {
    const buffer = await file.arrayBuffer();
    return await parseProjectExcel(buffer);
  }

  throw new Error(`Unsupported file format: ${ext}`);
}

// ─────────────────────────────────────────────────────────
// SERVER CALL (removed — file import is handled by /api/import route)
// ─────────────────────────────────────────────────────────

async function analyzeViaServer(file: File): Promise<ImportedProjectData> {
  throw new Error(
    `Direct converter fetch is disabled. Use POST /api/import instead. (file: ${file.name})`
  );
}

// ─────────────────────────────────────────────────────────
// DATE PARSING — the critical part
// ─────────────────────────────────────────────────────────

/**
 * Parse date strings from mpxj. Handles multiple formats:
 *   - ISO: "2012-11-01T08:00:00"
 *   - mpxj Java: "Thu Nov 01 08:00:00 UTC 2012"
 *   - Date only: "2012-11-01"
 *   - US style: "11/01/2012"
 *
 * Returns { date, raw, ok } so we can track what worked and what didn't.
 */
function parseDateStrict(
  s: string | undefined
): { date: Date | null; raw: string; ok: boolean } {
  const raw = (s ?? "").trim();
  if (!raw || raw === "null" || raw === "None" || raw === "") {
    return { date: null, raw, ok: true }; // legitimately empty
  }

  // Attempt 1: Native JS Date (handles ISO, most standard formats)
  let d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return { date: d, raw, ok: true };
  }

  // Attempt 2: mpxj Java format "Thu Nov 01 08:00:00 UTC 2012"
  const javaMatch = raw.match(
    /\w+\s+(\w{3})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})\s+(\w+)\s+(\d{4})/
  );
  if (javaMatch) {
    const [, month, day, time, tz, year] = javaMatch;
    d = new Date(`${month} ${day} ${year} ${time} ${tz}`);
    if (!isNaN(d.getTime())) {
      return { date: d, raw, ok: true };
    }
  }

  // Attempt 3: "01-Nov-2012" or "01/Nov/2012"
  const dmy = raw.match(/(\d{1,2})[-/](\w{3,})[-/](\d{4})/);
  if (dmy) {
    d = new Date(`${dmy[2]} ${dmy[1]} ${dmy[3]}`);
    if (!isNaN(d.getTime())) return { date: d, raw, ok: true };
  }

  // Failed
  return { date: null, raw, ok: false };
}

function parseDateOrNull(s: string | undefined): Date | null {
  return parseDateStrict(s).date;
}

function parseDateOrNow(s: string | undefined): Date {
  return parseDateStrict(s).date ?? new Date();
}

// ─────────────────────────────────────────────────────────
// OTHER HELPERS
// ─────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

function parseDuration(s: string | undefined): number {
  if (!s) return 0;
  const m = s.match(/([\d.]+)\s*([a-zA-Z]*)/);
  if (!m) return 0;
  const v = parseFloat(m[1]);
  switch ((m[2] || "d").toLowerCase()) {
    case "m": case "min": return v / 480;
    case "h":             return v / 8;
    case "w": case "ew":  return v * 5;
    case "mo": case "emo":return v * 20;
    case "y":             return v * 250;
    default:              return v;
  }
}

function pct(s: string | undefined): number {
  if (!s) return 0;
  const n = parseFloat(s.replace("%", ""));
  return isNaN(n) ? 0 : n;
}

function bool(s: string | undefined): boolean {
  return s?.toLowerCase() === "true" || s?.toLowerCase() === "yes";
}

function str(s: string | undefined): string {
  return !s || s === "null" || s === "None" ? "" : s;
}

function sourceLabel(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    mpp: "MS Project", mpt: "MS Project Template", mpx: "MS Project Exchange",
    xer: "Primavera P6 XER", pmxml: "Primavera P6 XML", xml: "XML/MSPDI",
    pp: "Asta Powerproject", pod: "Asta Powerproject", gan: "GanttProject",
    planner: "Gnome Planner", sdef: "USACE SDEF", fts: "FastTrack",
    xlsx: "Excel", csv: "CSV",
  };
  return map[ext] ?? ext.toUpperCase();
}

// ─────────────────────────────────────────────────────────
// FULL JSON → ImportedProjectData MAPPER
// ─────────────────────────────────────────────────────────

export function mapAnalyzeResponse(
  raw: HFAnalyzeResponse,
  filename: string
): ImportedProjectData {
  const info = raw.project_info ?? {};
  const dateWarnings: DateWarning[] = [];

  // Build UID → internal ID maps
  const taskUidMap = new Map<string, string>();
  const taskIdMap  = new Map<string, string>();
  const resUidMap  = new Map<string, string>();

  // ── ACTIVITY CODES (P6-style) ──
  // Parse definitions and build lookup for enriching tasks
  const activityCodes: ActivityCode[] = (raw.activity_codes ?? []).map((ac) => ({
    codeName: str(ac["Code Name"]) || str(ac["Name"]) || "",
    description: str(ac["Description"]) || str(ac["Desc"]) || "",
    value: str(ac["Value"]) || str(ac["Code Value"]) || "",
  })).filter(ac => ac.codeName);

  // Unique code names → used to detect activity code fields on tasks
  const activityCodeNames = new Set(activityCodes.map(ac => ac.codeName));

  // Build value→description lookup per code name for display enrichment
  // e.g. { "PROJECT PHASE": { "E": "Engineering", "P": "Procurement" } }
  const codeValueLookup = new Map<string, Map<string, string>>();
  for (const ac of activityCodes) {
    if (!codeValueLookup.has(ac.codeName)) {
      codeValueLookup.set(ac.codeName, new Map());
    }
    if (ac.value && ac.description) {
      codeValueLookup.get(ac.codeName)!.set(ac.value, ac.description);
    }
  }

  // Also collect known standard fields to EXCLUDE from activity code detection
  const standardFields = new Set([
    "ID", "Unique ID", "Name", "Task Name", "Start", "Finish", "Duration",
    "% Complete", "Percent Complete", "Summary", "Milestone", "Outline Level",
    "WBS", "Activity ID", "Activity Type", "Priority", "Type",
    "Earned Value Method", "Constraint Type", "Constraint Date",
    "Deadline", "Notes", "Hyperlink",
    // Fields already captured or structural noise
    "Total Slack", "Free Slack", "Work", "Actual Work", "Remaining Work",
    "Baseline Start", "Baseline Finish", "Baseline Duration", "Baseline Work",
    "Actual Start", "Actual Finish", "Actual Duration",
    "Early Start", "Early Finish", "Late Start", "Late Finish",
    "Calendar", "Calendar UID", "Resource Group",
    "Critical", "Level Assignments", "Leveling Can Split",
    "Outline Number", "Predecessors", "Successors",
    "Cost", "Actual Cost", "Remaining Cost", "Baseline Cost",
    "Fixed Cost", "Fixed Cost Accrual",
    "GUID", "Task GUID", "Created", "Stop", "Resume",
    "Rollup", "Hide Bar", "Ignore Resource Calendar",
    "Active", "Manual", "Placeholder",
  ]);

  // ── TASKS ──
  const tasks: Task[] = (raw.tasks ?? [])
    .filter((t) => str(t["Name"]) || str(t["Task Name"]))
    .map((t, i) => {
      const internalId = generateId("task");
      const uid = str(t["Unique ID"]);
      const id  = str(t["ID"]);
      if (uid) taskUidMap.set(uid, internalId);
      if (id)  taskIdMap.set(id, internalId);

      const taskName = str(t["Name"]) || str(t["Task Name"]) || `Task ${i}`;

      // ─── DATE PARSING WITH VALIDATION ───
      const startRaw  = str(t["Start"]);
      const finishRaw = str(t["Finish"]);

      const startParsed  = parseDateStrict(startRaw);
      const finishParsed = parseDateStrict(finishRaw);

      // Collect warnings
      if (startRaw && !startParsed.ok) {
        dateWarnings.push({
          taskIndex: i, taskName, field: "Start",
          rawValue: startRaw, parsedAs: null,
          issue: "unparseable"
        });
      }
      if (finishRaw && !finishParsed.ok) {
        dateWarnings.push({
          taskIndex: i, taskName, field: "Finish",
          rawValue: finishRaw, parsedAs: null,
          issue: "unparseable"
        });
      }
      if (!startRaw && !bool(t["Summary"])) {
        dateWarnings.push({
          taskIndex: i, taskName, field: "Start",
          rawValue: "(empty)", parsedAs: null,
          issue: "fallback_to_now"
        });
      }
      if (!finishRaw && !bool(t["Summary"])) {
        dateWarnings.push({
          taskIndex: i, taskName, field: "Finish",
          rawValue: "(empty)", parsedAs: null,
          issue: "fallback_to_now"
        });
      }

      const start  = startParsed.date ?? new Date();
      const finish = finishParsed.date ?? new Date();

      // Check start > finish (suspicious unless milestone)
      if (
        startParsed.date && finishParsed.date &&
        startParsed.date > finishParsed.date &&
        !bool(t["Milestone"])
      ) {
        dateWarnings.push({
          taskIndex: i, taskName, field: "Start > Finish",
          rawValue: `${startRaw} → ${finishRaw}`,
          parsedAs: startParsed.date,
          issue: "start_after_finish"
        });
      }

      // Check suspicious years (before 1980 or after 2050)
      for (const { date, field, raw: rawVal } of [
        { date: startParsed.date, field: "Start", raw: startRaw },
        { date: finishParsed.date, field: "Finish", raw: finishRaw },
      ]) {
        if (date) {
          const year = date.getFullYear();
          if (year < 1980 || year > 2050) {
            dateWarnings.push({
              taskIndex: i, taskName, field,
              rawValue: rawVal, parsedAs: date,
              issue: "suspicious_year"
            });
          }
        }
      }

      // Duration
      let dur = parseDuration(t["Duration"]);
      if (dur === 0 && start && finish) {
        dur = Math.max(0, (finish.getTime() - start.getTime()) / 86_400_000);
      }

      // Custom fields — capture Text/Number/Flag fields AND activity code fields
      const customText: Record<string, string> = {};
      for (const [k, v] of Object.entries(t)) {
        if (!v || v === "null" || v === "None" || v === "") continue;

        // Standard Text/Number/Flag fields (MS Project style)
        if (k.startsWith("Text")) {
          customText[k] = v;
          continue;
        }
        if (k.startsWith("Number")) {
          // Skip zero-value Number fields (0, 0.0, 0.00, etc.)
          const num = parseFloat(v);
          if (isNaN(num) || num === 0) continue;
          customText[k] = v;
          continue;
        }
        if (k.startsWith("Flag")) {
          // Skip false/no/0 Flag fields
          if (v.toLowerCase() === "false" || v === "0" || v.toLowerCase() === "no") continue;
          customText[k] = v;
          continue;
        }

        // Activity code fields — either known from activity_codes definitions
        // or detected as non-standard fields on tasks
        if (activityCodeNames.has(k)) {
          // Look up description if we have it
          const desc = codeValueLookup.get(k)?.get(v);
          customText[k] = desc ? `${v} (${desc})` : v;
          continue;
        }

        // Any other non-standard field with a value → capture as custom
        if (!standardFields.has(k) && !k.startsWith("_") && k.length > 1) {
          customText[k] = v;
        }
      }

      const task: Task = {
        id: internalId,
        name: taskName,
        start,
        finish,
        duration: Math.round(dur * 10) / 10,
        percentComplete: pct(t["% Complete"] || t["Percent Complete"]),
        isSummary: bool(t["Summary"]),
        isMilestone: bool(t["Milestone"]),
        level: parseInt(t["Outline Level"] ?? "1", 10) - 1,
        wbs: str(t["WBS"]),
        parentId: null,
        activityId: str(t["Activity ID"]) || undefined,
        status: str(t["Activity Type"]) || undefined,
        customText: Object.keys(customText).length > 0 ? customText : undefined,
        // Store raw date strings for preview tooltip
        _rawStart: startRaw || undefined,
        _rawFinish: finishRaw || undefined,
      } as Task & { _rawStart?: string; _rawFinish?: string };

      return task;
    });

  // Compute parent hierarchy
  const stack: Task[] = [];
  tasks.forEach((task) => {
    while (stack.length > 0 && (stack[stack.length - 1].level ?? 0) >= (task.level ?? 0)) stack.pop();
    if (stack.length > 0) task.parentId = stack[stack.length - 1].id;
    stack.push(task);
  });

  // ── RESOURCES ──
  const resources: Resource[] = (raw.resources ?? [])
    .filter((r) => str(r["Name"]))
    .map((r, i) => {
      const internalId = generateId("res");
      const uid = str(r["Unique ID"]);
      const id  = str(r["ID"]);
      if (uid) resUidMap.set(uid, internalId);
      if (id)  resUidMap.set(id, internalId);

      return {
        id: internalId,
        name: str(r["Name"]) || `Resource ${i}`,
        type: str(r["Type"]) || "Work",
        availability: 1,
        email: str(r["Email Address"]) || str(r["Email"]) || undefined,
        group: str(r["Group"]) || undefined,
        standardRate: str(r["Standard Rate"]) || undefined,
        overtimeRate: str(r["Overtime Rate"]) || undefined,
      } as Resource;
    });

  // ── LINKS ──
  const links: Link[] = (raw.predecessors ?? []).map((p) => {
    const targetId =
      taskIdMap.get(str(p["Task ID"])) ??
      taskUidMap.get(str(p["Task Unique ID"])) ??
      str(p["Task ID"]);
    const sourceId =
      taskIdMap.get(str(p["Predecessor ID"])) ??
      taskUidMap.get(str(p["Predecessor Unique ID"])) ??
      str(p["Predecessor ID"]);

    const typeStr = str(p["Type"]).toUpperCase();
    let type: LinkType = "FS";
    if (typeStr.includes("SS") || typeStr === "START_START") type = "SS";
    else if (typeStr.includes("FF") || typeStr === "FINISH_FINISH") type = "FF";
    else if (typeStr.includes("SF") || typeStr === "START_FINISH") type = "SF";

    return {
      id: generateId("link"),
      source: sourceId,
      target: targetId,
      type,
      lag: 0,
    };
  });

  // ── ASSIGNMENTS ──
  const assignments: Assignment[] = (raw.assignments ?? [])
    .filter((a) => str(a["Task ID"]) || str(a["Task Unique ID"]))
    .map((a) => {
      const taskId =
        taskIdMap.get(str(a["Task ID"])) ??
        taskUidMap.get(str(a["Task Unique ID"])) ??
        str(a["Task ID"]);
      const resId =
        resUidMap.get(str(a["Resource ID"])) ??
        resUidMap.get(str(a["Resource Unique ID"])) ??
        str(a["Resource ID"]);

      let units = 100;
      const unitsStr = str(a["Units"]);
      if (unitsStr) {
        const parsed = parseFloat(unitsStr.replace("%", ""));
        if (!isNaN(parsed)) units = parsed > 1 ? parsed : parsed * 100;
      }

      return {
        id: generateId("asn"),
        taskId,
        resourceId: resId,
        units,
        _taskName: str(a["Task Name"]),
        _resourceName: str(a["Resource Name"]),
      } as Assignment & { _taskName?: string; _resourceName?: string };
    });

  // ── CALENDARS ──
  // Map /analyze day strings like "WORKING [08:00-12:00, 13:00-17:00]"
  // or "NON_WORKING" into the engine's workingDays: number[] format
  // and parse exception strings into Exception[] objects.

  const isWorkingStr = (s: string | undefined): boolean => {
    if (!s) return false;
    const upper = s.toUpperCase();
    return upper.includes("WORKING") && !upper.includes("NON_WORKING") && !upper.includes("NON-WORKING");
  };

  // Day fields in /analyze output, mapped to JS getDay() indices
  const dayFields: [string, number][] = [
    ["Sunday", 0], ["Monday", 1], ["Tuesday", 2], ["Wednesday", 3],
    ["Thursday", 4], ["Friday", 5], ["Saturday", 6],
  ];

  const calendars: Calendar[] = (raw.calendars ?? []).map((c) => {
    // Build workingDays array from day strings
    const workingDays: number[] = [];
    for (const [field, dayIndex] of dayFields) {
      if (isWorkingStr(str(c[field]))) {
        workingDays.push(dayIndex);
      }
    }

    // If no day info was provided at all, default to Mon-Fri
    if (
      !str(c["Sunday"]) && !str(c["Monday"]) && !str(c["Tuesday"]) &&
      !str(c["Wednesday"]) && !str(c["Thursday"]) && !str(c["Friday"]) && !str(c["Saturday"])
    ) {
      workingDays.push(1, 2, 3, 4, 5); // Mon-Fri default
    }

    // Parse exceptions string → Exception[] objects
    // /analyze may return exceptions as a semicolon or comma-separated string like:
    //   "Christmas: 2012-12-25 to 2012-12-25; New Year: 2013-01-01 to 2013-01-01"
    // or just dates like "2012-12-25, 2013-01-01"
    const exceptions: Array<{
      id: string; name: string; start: Date; finish: Date; isActive: boolean;
    }> = [];

    const rawExceptions = str(c["Exceptions"]);
    if (rawExceptions) {
      // Try splitting by semicolons first, then commas
      const parts = rawExceptions.includes(";")
        ? rawExceptions.split(";")
        : rawExceptions.split(",");

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        // Pattern: "Name: YYYY-MM-DD to YYYY-MM-DD" or "Name: YYYY-MM-DD"
        const namedRange = trimmed.match(/^(.+?):\s*(.+?)(?:\s+to\s+(.+))?$/i);
        if (namedRange) {
          const name = namedRange[1].trim();
          const startDate = parseDateOrNull(namedRange[2].trim());
          const endDate = namedRange[3] ? parseDateOrNull(namedRange[3].trim()) : startDate;
          if (startDate) {
            exceptions.push({
              id: generateId("ex"),
              name,
              start: startDate,
              finish: endDate ?? startDate,
              isActive: true,
            });
          }
          continue;
        }

        // Pattern: just a date "YYYY-MM-DD" or "Dec 25, 2012"
        const dateOnly = parseDateOrNull(trimmed);
        if (dateOnly) {
          exceptions.push({
            id: generateId("ex"),
            name: `Exception ${format(dateOnly, "MMM dd, yyyy")}`,
            start: dateOnly,
            finish: dateOnly,
            isActive: true,
          });
        }
      }
    }

    return {
      id: generateId("cal"),
      name: str(c["Name"]) || "Unnamed",
      workingDays,
      exceptions,
      workingDayOverrides: [],
      nonWorkingDayOverrides: [],
      // Preserve raw data for preview tooltips
      _rawDays: {
        sunday: str(c["Sunday"]), monday: str(c["Monday"]),
        tuesday: str(c["Tuesday"]), wednesday: str(c["Wednesday"]),
        thursday: str(c["Thursday"]), friday: str(c["Friday"]),
        saturday: str(c["Saturday"]),
      },
      _calendarType: str(c["Type"]),
      _parentCalendar: str(c["Parent Calendar"]),
    } as Calendar;
  });

  // ── PROJECT INFO ──
  const projectInfo: Record<string, string> = {};
  for (const [k, v] of Object.entries(info)) {
    if (v && v !== "null" && v !== "None" && v !== "") {
      projectInfo[k] = v;
    }
  }

  return {
    name:
      info["Project Title"] ||
      info["Project ID"] ||
      filename.replace(/\.[^/.]+$/, ""),
    tasks,
    links,
    resources,
    assignments,
    calendars,
    sourceFormat: sourceLabel(filename),
    projectInfo,
    activityCodes: activityCodes.length > 0 ? activityCodes : undefined,
    dateWarnings: dateWarnings.length > 0 ? dateWarnings : undefined,
    stats: computeStats(tasks, dateWarnings),
  };
}
