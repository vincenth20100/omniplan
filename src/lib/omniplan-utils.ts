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
  parseProjectXML,
  parseProjectExcel,
  computeStats,
} from "./import-utils";
import { Task, Link, Resource, Assignment, Calendar, LinkType } from "./types";

// ─────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────
const API_BASE =
  process.env.NEXT_PUBLIC_OMNIPLAN_API_URL ??
  "https://vincentheloin-omniplan-converter.hf.space";

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
interface HFAnalyzeResponse {
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
// SERVER CALL
// ─────────────────────────────────────────────────────────

async function analyzeViaServer(file: File): Promise<ImportedProjectData> {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`${API_BASE}/analyze`, { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Analysis failed" }));
    throw new Error(err.error || `Server Error ${res.status}`);
  }

  const raw: HFAnalyzeResponse = await res.json();
  if (raw.error) throw new Error(raw.error);

  return mapAnalyzeResponse(raw, file.name);
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

function mapAnalyzeResponse(
  raw: HFAnalyzeResponse,
  filename: string
): ImportedProjectData {
  const info = raw.project_info ?? {};
  const dateWarnings: DateWarning[] = [];

  // Build UID → internal ID maps
  const taskUidMap = new Map<string, string>();
  const taskIdMap  = new Map<string, string>();
  const resUidMap  = new Map<string, string>();

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

      // Custom fields
      const customText: Record<string, string> = {};
      for (const [k, v] of Object.entries(t)) {
        if (v && v !== "null" && (k.startsWith("Text") || k.startsWith("Number") || k.startsWith("Flag"))) {
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
    while (stack.length > 0 && stack[stack.length - 1].level >= task.level) stack.pop();
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
  const calendars: Calendar[] = (raw.calendars ?? []).map((c) => ({
    id: generateId("cal"),
    name: str(c["Name"]) || "Unnamed",
    type: str(c["Type"]) || undefined,
    parentCalendar: str(c["Parent Calendar"]) || undefined,
    sunday:    str(c["Sunday"])    || undefined,
    monday:    str(c["Monday"])    || undefined,
    tuesday:   str(c["Tuesday"])   || undefined,
    wednesday: str(c["Wednesday"]) || undefined,
    thursday:  str(c["Thursday"])  || undefined,
    friday:    str(c["Friday"])    || undefined,
    saturday:  str(c["Saturday"])  || undefined,
    exceptions: str(c["Exceptions"]) || undefined,
  } as unknown as Calendar));

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
    dateWarnings: dateWarnings.length > 0 ? dateWarnings : undefined,
    stats: computeStats(tasks, dateWarnings),
  };
}
