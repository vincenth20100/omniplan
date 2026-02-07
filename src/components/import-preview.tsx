import React, { useState } from "react";
import { ImportedProjectData } from "@/lib/import-utils";
import { format } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2, Download, ChevronDown,
  ListChecks, Users, Link2, CalendarDays, Tag, Info, FileText
} from "lucide-react";

interface ImportPreviewProps {
  data: ImportedProjectData;
  sourceFile?: File;
  onCancel: () => void;
  onConfirm: () => void;
  onDownload?: (format: "json" | "xml" | "xlsx" | "pmxml") => void;
}

export function ImportPreview({
  data,
  sourceFile,
  onCancel,
  onConfirm,
  onDownload,
}: ImportPreviewProps) {
  const [activeTab, setActiveTab] = useState("tasks");

  // ── Safe access with fallbacks (prevents "undefined.length" crashes) ──
  const tasks       = data.tasks ?? [];
  const links       = data.links ?? [];
  const resources   = data.resources ?? [];
  const assignments = data.assignments ?? [];
  const calendars   = data.calendars ?? [];

  // Feature detection from task sample
  const sampleTasks     = tasks.slice(0, 50);
  const hasActivityId   = sampleTasks.some(t => t.activityId);
  const hasWbs          = sampleTasks.some(t => t.wbs);
  const hasCustomFields = sampleTasks.some(t => t.customText && Object.keys(t.customText).length > 0);
  const hasMilestones   = sampleTasks.some(t => t.isMilestone);

  const safeFormat = (d: Date | undefined | null) => {
    if (!d || isNaN(d.getTime())) return "\u2014";
    return format(d, "MMM dd, yyyy");
  };

  return (
    <div className="flex flex-col gap-4 py-2 animate-in fade-in duration-500">

      {/* ── Stats Header ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          title="Project"
          value={data.name}
          icon={<FileText className="h-4 w-4 text-blue-500" />}
          sub={data.sourceFormat}
        />
        <StatCard
          title="Tasks"
          value={tasks.length}
          icon={<ListChecks className="h-4 w-4 text-green-500" />}
          sub={hasMilestones ? `${tasks.filter(t => t.isMilestone).length} milestones` : undefined}
        />
        <StatCard
          title="Resources"
          value={resources.length}
          icon={<Users className="h-4 w-4 text-orange-500" />}
        />
        <StatCard
          title="Dependencies"
          value={links.length}
          icon={<Link2 className="h-4 w-4 text-purple-500" />}
          sub={assignments.length > 0 ? `${assignments.length} assignments` : undefined}
        />
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start h-10 bg-muted/40 p-1">
          <TabsTrigger value="tasks" className="text-xs gap-2">
            <ListChecks className="h-3 w-3" /> Tasks
          </TabsTrigger>
          {resources.length > 0 && (
            <TabsTrigger value="resources" className="text-xs gap-2">
              <Users className="h-3 w-3" /> Resources
            </TabsTrigger>
          )}
          {links.length > 0 && (
            <TabsTrigger value="dependencies" className="text-xs gap-2">
              <Link2 className="h-3 w-3" /> Dependencies
            </TabsTrigger>
          )}
          {assignments.length > 0 && (
            <TabsTrigger value="assignments" className="text-xs gap-2">
              <Tag className="h-3 w-3" /> Assignments
            </TabsTrigger>
          )}
        </TabsList>

        <div className="mt-2 border rounded-lg bg-card shadow-sm min-h-[400px]">

          {/* ── Tasks ── */}
          <TabsContent value="tasks" className="m-0 p-0">
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/90 z-10 backdrop-blur-sm">
                  <TableRow>
                    <TableHead className="w-[50px] text-[11px]">#</TableHead>
                    {hasActivityId && (
                      <TableHead className="text-[11px] text-blue-700">Activity ID</TableHead>
                    )}
                    {hasWbs && <TableHead className="text-[11px]">WBS</TableHead>}
                    <TableHead className="text-[11px]">Task Name</TableHead>
                    <TableHead className="text-[11px]">Start</TableHead>
                    <TableHead className="text-[11px]">Finish</TableHead>
                    <TableHead className="text-[11px]">Dur</TableHead>
                    <TableHead className="text-[11px]">%</TableHead>
                    {hasCustomFields && (
                      <TableHead className="text-[11px]">Custom</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.slice(0, 100).map((t, i) => (
                    <TableRow key={t.id || i} className="hover:bg-muted/30">
                      <TableCell className="text-[10px] text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      {hasActivityId && (
                        <TableCell className="text-[11px] font-mono text-blue-600">
                          {t.activityId || "\u2014"}
                        </TableCell>
                      )}
                      {hasWbs && (
                        <TableCell className="text-[10px] font-mono text-muted-foreground">
                          {t.wbs || "\u2014"}
                        </TableCell>
                      )}
                      <TableCell className="text-[12px] font-medium max-w-[300px] truncate">
                        <div className="flex items-center gap-1.5">
                          {t.isMilestone && (
                            <div
                              className="h-2 w-2 rotate-45 bg-purple-500 rounded-[1px]"
                              title="Milestone"
                            />
                          )}
                          {t.isSummary && (
                            <div className="h-2 w-2 bg-slate-400" title="Summary Task" />
                          )}
                          <span style={{ paddingLeft: `${Math.min((t.level ?? 0) * 10, 100)}px` }}>
                            {t.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[11px] whitespace-nowrap">
                        {safeFormat(t.start)}
                      </TableCell>
                      <TableCell className="text-[11px] whitespace-nowrap">
                        {safeFormat(t.finish)}
                      </TableCell>
                      <TableCell className="text-[11px]">
                        {typeof t.duration === "number" ? t.duration.toFixed(1) : t.duration}d
                      </TableCell>
                      <TableCell className="text-[11px]">
                        <div className="flex items-center gap-1">
                          <div className="h-1.5 w-8 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500"
                              style={{ width: `${t.percentComplete ?? 0}%` }}
                            />
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
                  ))}
                  {tasks.length > 100 && (
                    <TableRow>
                      <TableCell
                        colSpan={10}
                        className="text-center py-2 text-[11px] text-muted-foreground bg-muted/30"
                      >
                        &hellip; and {tasks.length - 100} more tasks
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ── Resources ── */}
          <TabsContent value="resources" className="m-0">
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/90 z-10">
                  <TableRow>
                    <TableHead className="text-[11px]">Name</TableHead>
                    <TableHead className="text-[11px]">Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resources.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-[12px] font-medium">{r.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {r.type || "Work"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ── Dependencies (uses data.links) ── */}
          <TabsContent value="dependencies" className="m-0">
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/90 z-10">
                  <TableRow>
                    <TableHead className="text-[11px]">Source Task</TableHead>
                    <TableHead className="text-[11px]">Target Task</TableHead>
                    <TableHead className="text-[11px]">Type</TableHead>
                    <TableHead className="text-[11px]">Lag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.slice(0, 50).map((link) => {
                    const sourceTask = tasks.find((t) => t.id === link.source);
                    const targetTask = tasks.find((t) => t.id === link.target);
                    return (
                      <TableRow key={link.id}>
                        <TableCell className="text-[11px] max-w-[200px] truncate" title={sourceTask?.name}>
                          {sourceTask?.name ?? link.source}
                        </TableCell>
                        <TableCell className="text-[11px] max-w-[200px] truncate" title={targetTask?.name}>
                          {targetTask?.name ?? link.target}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {link.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[11px] font-mono">
                          {link.lag ?? 0}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {links.length > 50 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center py-2 text-[11px] text-muted-foreground bg-muted/30"
                      >
                        &hellip; and {links.length - 50} more dependencies
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ── Assignments ── */}
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
                  {assignments.slice(0, 50).map((asn) => {
                    const task = tasks.find((t) => t.id === asn.taskId);
                    const res = resources.find((r) => r.id === asn.resourceId);
                    return (
                      <TableRow key={asn.id}>
                        <TableCell className="text-[11px] max-w-[200px] truncate">
                          {task?.name ?? asn.taskId}
                        </TableCell>
                        <TableCell className="text-[11px]">
                          {res?.name ?? asn.resourceId}
                        </TableCell>
                        <TableCell className="text-[11px] font-mono">
                          {asn.units}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {assignments.length > 50 && (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-center py-2 text-[11px] text-muted-foreground bg-muted/30"
                      >
                        &hellip; and {assignments.length - 50} more assignments
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* ── Footer Actions ── */}
      <div className="flex justify-between items-center pt-2 border-t mt-2">
        <div className="text-xs text-muted-foreground">
          Previewing <strong>{tasks.length}</strong> tasks
          {sourceFile && (
            <> from <strong>{sourceFile.name}</strong></>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            className="bg-primary text-primary-foreground gap-2"
          >
            <CheckCircle2 className="h-4 w-4" /> Import Project
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  sub,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  sub?: string;
}) {
  return (
    <Card className="shadow-none border bg-muted/10">
      <CardContent className="p-3 flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-background border flex items-center justify-center shadow-sm">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase">
            {title}
          </p>
          <div className="text-lg font-bold leading-none truncate">{value}</div>
          {sub && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
