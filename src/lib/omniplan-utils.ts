/**
 * omniplan-utils.ts
 *
 * Client-side entry point.
 * Bridges the gap between the Python "Conversion Service" and the local "Import Logic".
 */

import { ImportedProjectData, parseProjectXML, parseProjectExcel } from "./import-utils";

// ─────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────
const API_BASE =
  process.env.NEXT_PUBLIC_OMNIPLAN_API_URL ??
  "https://vincentheloin-omniplan-converter.hf.space";

// Formats that MUST be converted by the Python server first
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

/**
 * Main function: Analyzes ANY project file.
 * - Binary files (MPP, XER) -> Converted to XML on Server -> Parsed Locally
 * - XML/Excel files -> Parsed Locally immediately
 */
export async function analyzeProjectFile(file: File): Promise<ImportedProjectData> {
  const ext = "." + file.name.toLowerCase().split(".").pop();

  // ROUTE 1: Server-Side Conversion (Preserves P6 Data via MSPDI)
  if (SERVER_EXTENSIONS.has(ext)) {
    console.log(`[Import] Routing ${ext} to server for XML conversion...`);
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("format", "xml"); // Request MS Project XML (MSPDI)

    const res = await fetch(`${API_BASE}/convert`, { method: "POST", body: formData });
    
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Server conversion failed" }));
        throw new Error(err.error || `Server Error ${res.status}`);
    }

    // Get the XML text which now contains all the P6 data in ExtendedAttributes
    const xmlText = await res.text();
    return parseProjectXML(xmlText);
  }

  // ROUTE 2: Local XML Parsing
  if (ext === ".xml") {
    const text = await file.text();
    return parseProjectXML(text);
  }

  // ROUTE 3: Local Excel/CSV Parsing
  if (ext === ".xlsx" || ext === ".csv") {
    const buffer = await file.arrayBuffer();
    return parseProjectExcel(buffer);
  }

  throw new Error(`Unsupported file format: ${ext}`);
}
