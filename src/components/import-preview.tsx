import React, { useState } from "react";
import { ImportedProjectData, DateWarning } from "@/lib/import-utils";
import { format } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2, AlertTriangle, XCircle,
  ListChecks, Users, Link2, CalendarDays, Info, Paperclip, ShieldCheck,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ImportPreviewProps {
  data: ImportedProjectData;
  sourceFile?: File;
  onCancel: () => void;
  onConfirm: () => void;
  onDownload?: (format: "json" | "xml" | "xlsx" | "pmxml") => void;
}

export function ImportPreview({
  data, sourceFile, onCancel, onConfirm, onDownload,
}: ImportPreviewProps) {
  // ── Safe access ──
  const tasks       = data.tasks ?? [];
  const links       = data.links ?? [];
  const resources   = data.resources ?? [];
  const assignments = data.assignments ?? [];
  const calendars   = data.calendars ?? [];
  const projectInfo = data.projectInfo ?? {};
  const warnings    = data.dateWarnings ?? [];
  const stats       = data.stats;

  const hasProjectInfo = Object.keys(projectInfo).length > 0;
  const hasWarnings    = warnings.length > 0;

  // Default tab: show data quality if warnings, else project info, else tasks
  const [activeTab, setActiveTab] = useState(
    hasWarnings ? "quality" : hasProjectInfo ? "info" : "tasks"
  );

  // Feature detection
  const sample          = tasks.slice(0, 50);
  const hasActivityId   = sample.some(t => t.activityId);
  const hasWbs          = sample.some(t => t.wbs);
  const hasCustomFields = sample.some(t => t.customText && Object.keys(t.customText).length > 0);
  const hasMilestones   = sample.some(t => t.isMilestone);

  const fmt = (d: Date | undefined | null, showTime = false) => {
    if (!d || isNaN(d.getTime())) return "\u2014";
    return format(d, showTime ? "MMM dd, yyyy HH:mm" : "MMM dd, yyyy");
  };

  // Group warnings by type for summary
  const warningsByType = warnings.reduce<Record<string, DateWarning[]>>((acc, w) => {
    (acc[w.issue] ??= []).push(w);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 py-2 animate-in fade-in duration-500">

      {/* ═══════ Stats Row ═══════ */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        <StatCard label="Tasks" value={tasks.length} color="text-green-600"
          sub={hasMilestones ? `${tasks.filter(t => t.isMilestone).length} milestones` : undefined} />
        <StatCard label="Resources" value={resources.length} color="text-orange-600" />
        <StatCard label="Assignments" value={assignments.length} color="text-blue-600" />
        <StatCard label="Dependencies" value={links.length} color="text-purple-600" />
        <StatCard label="Calendars" value={calendars.length} color="text-teal-600" />
      </div>

      {/* ── Date Range Summary ── */}
      {stats?.minDate && stats?.maxDate && (
        <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-md text-xs">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Project span:</span>
          <span className="font-medium">{fmt(stats.minDate)}</span>
          <span className="text-muted-foreground">&rarr;</span>
          <span className="font-medium">{fmt(stats.maxDate)}</span>
          {stats.tasksWithMissingDates > 0 && (
            <Badge variant="outline" className="text-[9px] ml-auto text-amber-600 border-amber-300">
              {stats.tasksWithMissingDates} tasks missing dates
            </Badge>
          )}
        </div>
      )}

      {/* ═══════ Tabs ═══════ */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start h-10 bg-muted/40 p-1 flex-wrap">
          {/* Data Quality tab — always shown, changes icon based on warnings */}
          <TabsTrigger value="quality" className="text-xs gap-1.5">
            {hasWarnings
              ? <AlertTriangle className="h-3 w-3 text-amber-500" />
              : <ShieldCheck className="h-3 w-3 text-green-500" />}
            Data Quality
            {hasWarnings && (
              <Badge variant="destructive" className="text-[9px] px-1 py-0 ml-0.5">{warnings.length}</Badge>
            )}
          </TabsTrigger>
          {hasProjectInfo && (
            <TabsTrigger value="info" className="text-xs gap-1.5">
              <Info className="h-3 w-3" /> Project Info
            </TabsTrigger>
          )}
          <TabsTrigger value="tasks" className="text-xs gap-1.5">
            <ListChecks className="h-3 w-3" /> Tasks
            <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-0.5">{tasks.length}</Badge>
          </TabsTrigger>
          {resources.length > 0 && (
            <TabsTrigger value="resources" className="text-xs gap-1.5">
              <Users className="h-3 w-3" /> Resources
              <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-0.5">{resources.length}</Badge>
            </TabsTrigger>
          )}
          {assignments.length > 0 && (
            <TabsTrigger value="assignments" className="text-xs gap-1.5">
              <Paperclip className="h-3 w-3" /> Assignments
              <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-0.5">{assignments.length}</Badge>
            </TabsTrigger>
          )}
          {links.length > 0 && (
            <TabsTrigger value="dependencies" className="text-xs gap-1.5">
              <Link2 className="h-3 w-3" /> Dependencies
              <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-0.5">{links.length}</Badge>
            </TabsTrigger>
          )}
          {calendars.length > 0 && (
            <TabsTrigger value="calendars" className="text-xs gap-1.5">
              <CalendarDays className="h-3 w-3" /> Calendars
              <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-0.5">{calendars.length}</Badge>
            </TabsTrigger>
          )}
        </TabsList>

        <div className="mt-2 border rounded-lg bg-card shadow-sm min-h-[420px]">

          {/* ═══════ DATA QUALITY ═══════ */}
          <TabsContent value="quality" className="m-0 p-4 space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat label="Tasks with dates" value={stats?.tasksWithDates ?? tasks.length}
                total={tasks.length} ok={!stats || stats.tasksWithMissingDates === 0} />
              <MiniStat label="Date warnings" value={warnings.length}
                ok={warnings.length === 0} />
              <MiniStat label="Summary tasks" value={stats?.summaryTasks ?? 0} />
              <MiniStat label="Milestones" value={stats?.milestones ?? 0} />
            </div>

            {!hasWarnings ? (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">All dates parsed successfully</AlertTitle>
                <AlertDescription className="text-green-700">
                  {tasks.length} tasks loaded with valid start/finish dates.
                  Project spans {fmt(stats?.minDate)} to {fmt(stats?.maxDate)}.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {/* Warning groups */}
                {warningsByType["unparseable"] && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>{warningsByType["unparseable"].length} unparseable date(s)</AlertTitle>
                    <AlertDescription>
                      These date strings could not be interpreted. Tasks default to today's date.
                    </AlertDescription>
                  </Alert>
                )}
                {warningsByType["fallback_to_now"] && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800">
                      {warningsByType["fallback_to_now"].length} empty date field(s)
                    </AlertTitle>
                    <AlertDescription className="text-amber-700">
                      Some tasks have no start or finish date in the source file. They default to today.
                    </AlertDescription>
                  </Alert>
                )}
                {warningsByType["start_after_finish"] && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800">
                      {warningsByType["start_after_finish"].length} task(s) where start &gt; finish
                    </AlertTitle>
                    <AlertDescription className="text-amber-700">
                      These tasks have a start date after their finish date.
                    </AlertDescription>
                  </Alert>
                )}
                {warningsByType["suspicious_year"] && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800">
                      {warningsByType["suspicious_year"].length} suspicious year(s)
                    </AlertTitle>
                    <AlertDescription className="text-amber-700">
                      Dates with years before 1980 or after 2050 were detected.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Detail table */}
                <div className="max-h-[300px] overflow-auto border rounded">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/90 z-10">
                      <TableRow>
                        <TableHead className="text-[11px]">#</TableHead>
                        <TableHead className="text-[11px]">Task</TableHead>
                        <TableHead className="text-[11px]">Field</TableHead>
                        <TableHead className="text-[11px]">Raw Value (from server)</TableHead>
                        <TableHead className="text-[11px]">Parsed As</TableHead>
                        <TableHead className="text-[11px]">Issue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {warnings.slice(0, 50).map((w, i) => (
                        <TableRow key={i} className="hover:bg-muted/30">
                          <TableCell className="text-[10px] text-muted-foreground">{w.taskIndex + 1}</TableCell>
                          <TableCell className="text-[11px] max-w-[180px] truncate">{w.taskName}</TableCell>
                          <TableCell className="text-[11px] font-mono">{w.field}</TableCell>
                          <TableCell className="text-[11px] font-mono text-red-600 max-w-[200px] truncate" title={w.rawValue}>
                            {w.rawValue}
                          </TableCell>
                          <TableCell className="text-[11px]">
                            {w.parsedAs ? fmt(w.parsedAs, true) : <span className="text-red-500">Failed</span>}
                          </TableCell>
                          <TableCell>
                            <IssueBadge issue={w.issue} />
                          </TableCell>
                        </TableRow>
                      ))}
                      {warnings.length > 50 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-2 text-[11px] text-muted-foreground bg-muted/30">
                            &hellip; and {warnings.length - 50} more warnings
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ═══════ PROJECT INFO ═══════ */}
          <TabsContent value="info" className="m-0 p-0">
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableBody>
                  {Object.entries(projectInfo).map(([key, val]) => (
                    <TableRow key={key}>
                      <TableCell className="text-[12px] font-semibold w-[200px] py-2.5">{key}</TableCell>
                      <TableCell className="text-[12px] py-2.5">{val}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ═══════ TASKS ═══════ */}
          <TabsContent value="tasks" className="m-0 p-0">
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/90 z-10 backdrop-blur-sm">
                  <TableRow>
                    <TableHead className="w-[50px] text-[11px]">#</TableHead>
                    {hasActivityId && <TableHead className="text-[11px] text-blue-700">Act. ID</TableHead>}
                    {hasWbs && <TableHead className="text-[11px]">WBS</TableHead>}
                    <TableHead className="text-[11px]">Task Name</TableHead>
                    <TableHead className="text-[11px]">Start</TableHead>
                    <TableHead className="text-[11px]">Finish</TableHead>
                    <TableHead className="text-[11px]">Dur</TableHead>
                    <TableHead className="text-[11px]">%</TableHead>
                    {hasCustomFields && <TableHead className="text-[11px]">Custom</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.slice(0, 100).map((t, i) => {
                    const tAny = t as any;
                    // Check if this task has a warning
                    const taskHasWarning = warnings.some(w => w.taskIndex === i);

                    return (
                      <TableRow key={t.id || i} className={`hover:bg-muted/30 ${taskHasWarning ? "bg-amber-50/50" : ""}`}>
                        <TableCell className="text-[10px] text-muted-foreground">{i + 1}</TableCell>
                        {hasActivityId && (
                          <TableCell className="text-[11px] font-mono text-blue-600">{t.activityId || "\u2014"}</TableCell>
                        )}
                        {hasWbs && (
                          <TableCell className="text-[10px] font-mono text-muted-foreground">{t.wbs || "\u2014"}</TableCell>
                        )}
                        <TableCell className="text-[12px] font-medium max-w-[300px] truncate">
                          <div className="flex items-center gap-1.5">
                            {t.isMilestone && (
                              <div className="h-2 w-2 rotate-45 bg-purple-500 rounded-[1px] shrink-0" title="Milestone" />
                            )}
                            {t.isSummary && (
                              <div className="h-2 w-2 bg-slate-400 shrink-0" title="Summary" />
                            )}
                            {taskHasWarning && (
                              <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                            )}
                            <span style={{ paddingLeft: `${Math.min((t.level ?? 0) * 12, 120)}px` }}>
                              {t.name}
                            </span>
                          </div>
                        </TableCell>
                        {/* Date cells with raw value tooltip */}
                        <TableCell
                          className="text-[11px] whitespace-nowrap cursor-help"
                          title={tAny._rawStart ? `Server: ${tAny._rawStart}` : undefined}
                        >
                          {fmt(t.start)}
                        </TableCell>
                        <TableCell
                          className="text-[11px] whitespace-nowrap cursor-help"
                          title={tAny._rawFinish ? `Server: ${tAny._rawFinish}` : undefined}
                        >
                          {fmt(t.finish)}
                        </TableCell>
                        <TableCell className="text-[11px]">{t.duration}d</TableCell>
                        <TableCell className="text-[11px]">
                          <div className="flex items-center gap-1">
                            <div className="h-1.5 w-8 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-green-500" style={{ width: `${t.percentComplete ?? 0}%` }} />
                            </div>
                            {t.percentComplete ?? 0}%
                          </div>
                        </TableCell>
                        {hasCustomFields && (
                          <TableCell className="text-[10px] text-muted-foreground max-w-[150px] truncate">
                            {t.customText ? Object.values(t.customText).join(", ") : ""}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {tasks.length > 100 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-2 text-[11px] text-muted-foreground bg-muted/30">
                        &hellip; and {tasks.length - 100} more tasks
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ═══════ RESOURCES ═══════ */}
          <TabsContent value="resources" className="m-0">
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/90 z-10">
                  <TableRow>
                    <TableHead className="text-[11px]">Name</TableHead>
                    <TableHead className="text-[11px]">Type</TableHead>
                    <TableHead className="text-[11px]">Group</TableHead>
                    <TableHead className="text-[11px]">Email</TableHead>
                    <TableHead className="text-[11px]">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resources.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-[12px] font-medium">{r.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{r.type || "Work"}</Badge>
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{r.group || "\u2014"}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{r.email || "\u2014"}</TableCell>
                      <TableCell className="text-[11px] font-mono text-muted-foreground">{r.standardRate || "\u2014"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ═══════ ASSIGNMENTS ═══════ */}
          <TabsContent value="assignments" className="m-0">
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/90 z-10">
                  <TableRow>
                    <TableHead className="text-[11px]">Task</TableHead>
                    <TableHead className="text-[11px]">Resource</TableHead>
                    <TableHead className="text-[11px]">Units</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.slice(0, 100).map((asn: any) => {
                    const taskName  = asn._taskName     || tasks.find(t => t.id === asn.taskId)?.name     || asn.taskId;
                    const resName   = asn._resourceName || resources.find(r => r.id === asn.resourceId)?.name || asn.resourceId;
                    return (
                      <TableRow key={asn.id}>
                        <TableCell className="text-[11px] max-w-[250px] truncate" title={taskName}>{taskName}</TableCell>
                        <TableCell className="text-[11px]">{resName}</TableCell>
                        <TableCell className="text-[11px] font-mono">{asn.units}%</TableCell>
                      </TableRow>
                    );
                  })}
                  {assignments.length > 100 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-2 text-[11px] text-muted-foreground bg-muted/30">
                        &hellip; and {assignments.length - 100} more assignments
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ═══════ DEPENDENCIES ═══════ */}
          <TabsContent value="dependencies" className="m-0">
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/90 z-10">
                  <TableRow>
                    <TableHead className="text-[11px]">Predecessor</TableHead>
                    <TableHead className="text-[11px]">Successor</TableHead>
                    <TableHead className="text-[11px]">Type</TableHead>
                    <TableHead className="text-[11px]">Lag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.slice(0, 100).map((link) => {
                    const srcTask = tasks.find(t => t.id === link.source);
                    const tgtTask = tasks.find(t => t.id === link.target);
                    return (
                      <TableRow key={link.id}>
                        <TableCell className="text-[11px] max-w-[220px] truncate" title={srcTask?.name}>
                          {srcTask?.name ?? link.source}
                        </TableCell>
                        <TableCell className="text-[11px] max-w-[220px] truncate" title={tgtTask?.name}>
                          {tgtTask?.name ?? link.target}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{link.type}</Badge>
                        </TableCell>
                        <TableCell className="text-[11px] font-mono">{link.lag ?? 0}</TableCell>
                      </TableRow>
                    );
                  })}
                  {links.length > 100 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-2 text-[11px] text-muted-foreground bg-muted/30">
                        &hellip; and {links.length - 100} more dependencies
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ═══════ CALENDARS ═══════ */}
          <TabsContent value="calendars" className="m-0">
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/90 z-10">
                  <TableRow>
                    <TableHead className="text-[11px]">Name</TableHead>
                    <TableHead className="text-[11px]">Type</TableHead>
                    <TableHead className="text-[11px]">Mon</TableHead>
                    <TableHead className="text-[11px]">Tue</TableHead>
                    <TableHead className="text-[11px]">Wed</TableHead>
                    <TableHead className="text-[11px]">Thu</TableHead>
                    <TableHead className="text-[11px]">Fri</TableHead>
                    <TableHead className="text-[11px]">Sat</TableHead>
                    <TableHead className="text-[11px]">Sun</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calendars.map((cal: any, i: number) => {
                    const dayBadge = (val: string | undefined) => {
                      if (!val) return <span className="text-[10px] text-muted-foreground">{"\u2014"}</span>;
                      const isWorking = val.toUpperCase().includes("WORKING") && !val.toUpperCase().includes("NON");
                      return (
                        <Badge variant="outline"
                          className={`text-[9px] ${isWorking
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-red-50 text-red-600 border-red-200"}`}>
                          {isWorking ? "Work" : "Off"}
                        </Badge>
                      );
                    };
                    return (
                      <TableRow key={cal.id || i}>
                        <TableCell className="text-[11px] font-medium">{cal.name}</TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">{cal.type || "\u2014"}</TableCell>
                        <TableCell>{dayBadge(cal.monday)}</TableCell>
                        <TableCell>{dayBadge(cal.tuesday)}</TableCell>
                        <TableCell>{dayBadge(cal.wednesday)}</TableCell>
                        <TableCell>{dayBadge(cal.thursday)}</TableCell>
                        <TableCell>{dayBadge(cal.friday)}</TableCell>
                        <TableCell>{dayBadge(cal.saturday)}</TableCell>
                        <TableCell>{dayBadge(cal.sunday)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* ═══════ Footer ═══════ */}
      <div className="flex justify-between items-center pt-2 border-t mt-2">
        <div className="text-xs text-muted-foreground">
          Previewing <strong>{tasks.length}</strong> tasks
          {sourceFile && <> from <strong>{sourceFile.name}</strong></>}
          {data.sourceFormat && <> &middot; {data.sourceFormat}</>}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={onConfirm} className="bg-primary text-primary-foreground gap-2">
            <CheckCircle2 className="h-4 w-4" /> Import Project
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────

function StatCard({ label, value, color, sub }: {
  label: string; value: string | number; color: string; sub?: string;
}) {
  return (
    <Card className="shadow-none border-dashed">
      <CardContent className="p-3 text-center">
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
        {sub && <div className="text-[9px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, total, ok }: {
  label: string; value: number; total?: number; ok?: boolean;
}) {
  return (
    <div className={`rounded-md border p-2.5 text-center ${
      ok === false ? "border-amber-200 bg-amber-50/50" : "border-muted"
    }`}>
      <div className="text-lg font-bold">
        {value}
        {total !== undefined && <span className="text-xs text-muted-foreground font-normal">/{total}</span>}
      </div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function IssueBadge({ issue }: { issue: string }) {
  const styles: Record<string, { label: string; cls: string }> = {
    unparseable:      { label: "Cannot parse",     cls: "bg-red-50 text-red-700 border-red-200" },
    fallback_to_now:  { label: "Empty → today",    cls: "bg-amber-50 text-amber-700 border-amber-200" },
    start_after_finish:{ label: "Start > Finish",  cls: "bg-amber-50 text-amber-700 border-amber-200" },
    suspicious_year:  { label: "Suspicious year",  cls: "bg-amber-50 text-amber-700 border-amber-200" },
  };
  const s = styles[issue] ?? { label: issue, cls: "bg-muted" };
  return <Badge variant="outline" className={`text-[9px] ${s.cls}`}>{s.label}</Badge>;
}
