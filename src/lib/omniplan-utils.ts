/**
 * omniplan-utils.ts
 *
 * Client for the Project File Converter service on Hugging Face Spaces.
 * Handles: .mpp, .mpt, .mpx, .xer, .pmxml, .xml, .pp, .pod, .planner,
 *          .gan, .sdef, .fts, .schedule_grid, .cdpx, .cdpz, .mpd, .mdb
 *
 * Usage:
 *   import { analyzeProjectFile } from "@/lib/omniplan-utils";
 *   const data = await analyzeProjectFile(file);
 */

import { ImportedProjectData } from "@/lib/import-utils";

// ─────────────────────────────────────────────────────────
// CONFIG — set your HF Space URL here or via env variable
// ─────────────────────────────────────────────────────────
const API_BASE =
  process.env.NEXT_PUBLIC_OMNIPLAN_API_URL ??
  "https://huggingface.co/spaces/vincentheloin/omniplan-converter";

// Extensions that MUST go through the server (binary / proprietary)
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

/** Returns true when the file cannot be parsed client-side */
export function requiresServer(filename: string): boolean {
  const ext = "." + filename.toLowerCase().split(".").pop();
  return SERVER_EXTENSIONS.has(ext);
}

// ─────────────────────────────────────────────────────────
// HF Space response types (matches /analyze JSON output)
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
// Public API
// ─────────────────────────────────────────────────────────

/** Health-check — call once at mount to show a banner if the service is down */
export async function checkServiceHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json();
    return data.jvm_error ? { ok: false, error: data.jvm_error } : { ok: true };
  } catch {
    return { ok: false, error: `Cannot reach converter at ${API_BASE}` };
  }
}

/**
 * Fetch raw analysis data from the external API without mapping it to internal format.
 * Useful for displaying raw data in a review UI before import.
 */
export async function fetchProjectAnalysis(file: File): Promise<HFAnalyzeResponse> {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`${API_BASE}/analyze`, { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `Server returned ${res.status}`);
  }

  const data: HFAnalyzeResponse = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

/**
 * Convert raw HF analysis response to the internal ImportedProjectData format.
 */
export function convertAnalysisToImportData(raw: HFAnalyzeResponse, filename: string): ImportedProjectData {
  const info = raw.project_info ?? {};

  // ── Tasks ──
  const tasks = raw.tasks
    .filter(t => t["Task Name"] && t["Task Name"] !== "null")
    .map((t, i) => {
      const start  = parseDateOrNow(t["Start"]);
      const finish = parseDateOrNow(t["Finish"]);
      let dur = parseDuration(t["Duration"]);
      if (dur === 0 && start && finish) {
        dur = Math.max(0, (finish.getTime() - start.getTime()) / 86_400_000);
      }

      const customText:    Record<string, string> = {};
      const customNumbers: Record<string, string> = {};
      const customDates:   Record<string, string> = {};
      const customFlags:   Record<string, string> = {};
      for (const [k, v] of Object.entries(t)) {
        if (!v || v === "null") continue;
        if (k.startsWith("Text"))   customText[k]    = v;
        if (k.startsWith("Number")) customNumbers[k]  = v;
        if (k.startsWith("Date"))   customDates[k]    = v;
        if (k.startsWith("Flag"))   customFlags[k]    = v;
      }

      return {
        id:               str(t["Unique ID"]) || str(t["ID"]) || String(i),
        outlineId:        str(t["ID"]),
        name:             str(t["Task Name"]) || `Task ${i}`,
        wbs:              str(t["WBS"]),
        outlineLevel:     parseInt(t["Outline Level"] ?? "0", 10) || 0,
        start,
        finish,
        duration:         dur,
        percentComplete:  pct(t["% Complete"]),
        isMilestone:      bool(t["Milestone"]),
        isSummary:        bool(t["Summary"]),
        isCritical:       bool(t["Critical"]),
        work:             str(t["Work"]),
        cost:             str(t["Cost"]),
        resources:        str(t["Resources"]),
        predecessors:     str(t["Predecessors"]),
        notes:            str(t["Notes"]),
        constraintType:   str(t["Constraint Type"]),
        constraintDate:   str(t["Constraint Date"]),
        deadline:         str(t["Deadline"]),
        priority:         str(t["Priority"]),
        baselineStart:    parseDate(t["Baseline Start"]) ?? undefined,
        baselineFinish:   parseDate(t["Baseline Finish"]) ?? undefined,
        baselineDuration: parseDuration(t["Baseline Duration"]),
        // P6 fields
        activityId:       str(t["Activity ID"]),
        activityType:     str(t["Activity Type"]),
        remainingDuration:parseDuration(t["Remaining Duration"]),
        actualDuration:   parseDuration(t["Actual Duration"]),
        actualStart:      parseDate(t["Actual Start"]) ?? undefined,
        actualFinish:     parseDate(t["Actual Finish"]) ?? undefined,
        calendar:         str(t["Calendar"]),
        // Custom
        customText:       Object.keys(customText).length   ? customText   : undefined,
        customNumbers:    Object.keys(customNumbers).length ? customNumbers : undefined,
        customDates:      Object.keys(customDates).length   ? customDates   : undefined,
        customFlags:      Object.keys(customFlags).length   ? customFlags   : undefined,
      };
    });

  // ── Resources ──
  const resources = raw.resources
    .filter(r => r["Name"] && r["Name"] !== "null")
    .map((r, i) => ({
      id:           str(r["Unique ID"]) || str(r["ID"]) || String(i),
      name:         str(r["Name"]) || `Resource ${i}`,
      type:         str(r["Type"]),
      initials:     str(r["Initials"]),
      group:        str(r["Group"]),
      email:        str(r["Email"]),
      maxUnits:     str(r["Max Units"]),
      standardRate: str(r["Standard Rate"]),
      overtimeRate: str(r["Overtime Rate"]),
      work:         str(r["Work"]),
      cost:         str(r["Cost"]),
      calendar:     str(r["Calendar"]),
      notes:        str(r["Notes"]),
    }));

  // ── Assignments ──
  const assignments = raw.assignments.map(a => ({
    taskId:       str(a["Task ID"]),
    taskName:     str(a["Task Name"]),
    resourceId:   str(a["Resource ID"]),
    resourceName: str(a["Resource Name"]),
    units:        str(a["Units"]),
    work:         str(a["Work"]),
    start:        str(a["Start"]),
    finish:       str(a["Finish"]),
    cost:         str(a["Cost"]),
  }));

  // ── Dependencies ──
  const dependencies = raw.predecessors.map(p => ({
    taskId:          str(p["Task ID"]),
    taskName:        str(p["Task Name"]),
    predecessorId:   str(p["Predecessor ID"]),
    predecessorName: str(p["Predecessor Name"]),
    type:            str(p["Type"]) || "FS",
    lag:             str(p["Lag"]) || "0",
  }));

  // ── Calendars ──
  const calendars = raw.calendars.map(c => ({
    name:           str(c["Name"]),
    uniqueId:       str(c["Unique ID"]),
    type:           str(c["Type"]),
    parentCalendar: str(c["Parent Calendar"]),
    exceptions:     str(c["Exceptions"]),
  }));

  // ── Activity Codes (P6) ──
  const activityCodes = (raw.activity_codes ?? []).map(ac => ({
    codeName:    str(ac["Code Name"]),
    value:       str(ac["Value"]),
    description: str(ac["Description"]),
  }));

  return {
    name: info["Project Title"] || info["Project ID"] || filename.replace(/\.[^/.]+$/, ""),
    tasks,
    resources,
    assignments,
    dependencies,
    calendars,
    activityCodes,
    projectInfo: info,
    sourceFormat: sourceLabel(filename),
  } as unknown as ImportedProjectData;
  // Cast to unknown first to avoid TS issues if ImportedProjectData doesn't strictly match the extra fields
  // (though in runtime these extra fields are useful for ImportPreview)
}


/**
 * Upload a project file → returns ImportedProjectData ready for your app.
 *
 * Works for every format the HF service supports. XER files in particular
 * come back with P6-specific fields (Activity ID, Activity Type, activity
 * codes, etc.) that local parsers miss.
 */
export async function analyzeProjectFile(file: File): Promise<ImportedProjectData> {
  const raw = await fetchProjectAnalysis(file);
  return convertAnalysisToImportData(raw, file.name);
}

/**
 * Download a converted file blob (json / xml / xlsx / pmxml / mpx / sdef).
 * Returns a Blob you can create a download link from.
 */
export async function convertProjectFile(
  file: File,
  format: "json" | "xml" | "xlsx" | "pmxml" | "mpx" | "sdef",
): Promise<Blob> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("format", format);

  const res = await fetch(`${API_BASE}/convert`, { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `Conversion failed (${res.status})`);
  }
  return res.blob();
}

// ─────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────

// Removed internal callAnalyze as it is now fetchProjectAnalysis

// ── Date helpers ────────────────────────────────────────

function parseDate(s: string | undefined): Date | null {
  if (!s || s === "" || s === "null" || s === "None") return null;

  // ISO or standard: "2024-01-15T08:00:00", "2024-01-15"
  let d = new Date(s);
  if (!isNaN(d.getTime())) return d;

  // mpxj format: "Thu Nov 01 08:00:00 UTC 2012"
  const m = s.match(/\w+\s+(\w+\s+\d+\s+\d+:\d+:\d+)\s+(\w+)\s+(\d{4})/);
  if (m) {
    d = new Date(`${m[1]} ${m[3]} ${m[2]}`);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function parseDateOrNow(s: string | undefined): Date {
  return parseDate(s) ?? new Date();
}

// ── Duration "10.0d" → days ─────────────────────────────

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
    default:              return v;        // "d", "ed", ""
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
  return (!s || s === "null" || s === "None") ? "" : s;
}

// ── Source format label ─────────────────────────────────

function sourceLabel(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    mpp: "Microsoft Project", mpt: "MS Project Template", mpx: "MS Project Exchange",
    xer: "Primavera P6 XER", pmxml: "Primavera P6 XML", xml: "XML",
    pp: "Asta Powerproject", pod: "Asta Powerproject", gan: "GanttProject",
    planner: "Gnome Planner", sdef: "USACE SDEF", fts: "FastTrack",
    xlsx: "Excel", csv: "CSV",
  };
  return map[ext] ?? ext.toUpperCase();
}
