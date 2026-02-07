import React, { useState } from "react";
import { ImportedProjectData } from "@/lib/import-utils";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2, Download, ChevronDown,
  ListChecks, Users, Link2, CalendarDays, Tag, Info,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

  // Detect P6-specific data
  const isP6 = data.sourceFormat?.includes("P6") ||
    data.tasks.some(t => t.activityId) ||
    (data.activityCodes && data.activityCodes.length > 0);

  // Detect which optional data sections exist
  const hasAssignments  = (data.assignments?.length ?? 0) > 0;
  const hasDependencies = (data.dependencies?.length ?? 0) > 0;
  const hasCalendars    = (data.calendars?.length ?? 0) > 0;
  const hasCodes        = (data.activityCodes?.length ?? 0) > 0;
  const hasProjectInfo  = data.projectInfo && Object.keys(data.projectInfo).length > 0;

  // Task columns auto-detect
  const sampleTasks = data.tasks.slice(0, 30);
  const hasWbs         = sampleTasks.some(t => t.wbs);
  const hasActivityId  = sampleTasks.some(t => t.activityId);
  const hasCritical    = sampleTasks.some(t => t.isCritical);
  const hasResources   = sampleTasks.some(t => t.resources);
  const hasPredStr     = sampleTasks.some(t => t.predecessors);
  const hasCost        = sampleTasks.some(t => t.cost);

  const safeFormat = (d: Date | undefined | null, fmt = "yyyy-MM-dd HH:mm"): string => {
    if (!d || isNaN(d.getTime())) return "—";
    return format(d, fmt);
  };

  return (
    <div className="flex flex-col gap-4 py-2">

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="shadow-none border-dashed">
          <CardHeader className="pb-1 py-2">
            <CardTitle className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
              Project
            </CardTitle>
          </CardHeader>
          <CardContent className="py-1">
            <div className="text-sm font-bold truncate" title={data.name}>{data.name}</div>
            {data.sourceFormat && (
              <Badge variant="outline" className="text-[10px] mt-1">{data.sourceFormat}</Badge>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none border-dashed">
          <CardHeader className="pb-1 py-2">
            <CardTitle className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
              Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="py-1">
            <div className="text-lg font-bold">{data.tasks.length}</div>
            {data.tasks.filter(t => t.isMilestone).length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {data.tasks.filter(t => t.isMilestone).length} milestones
              </span>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none border-dashed">
          <CardHeader className="pb-1 py-2">
            <CardTitle className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
              Resources
            </CardTitle>
          </CardHeader>
          <CardContent className="py-1">
            <div className="text-lg font-bold">{data.resources.length}</div>
          </CardContent>
        </Card>

        <Card className="shadow-none border-dashed">
          <CardHeader className="pb-1 py-2">
            <CardTitle className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
              Dependencies
            </CardTitle>
          </CardHeader>
          <CardContent className="py-1">
            <div className="text-lg font-bold">{data.dependencies?.length ?? 0}</div>
            {hasAssignments && (
              <span className="text-[10px] text-muted-foreground">
                {data.assignments!.length} assignments
              </span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Detected Columns ── */}
      <div className="space-y-1">
        <h4 className="text-xs font-semibold text-muted-foreground">Detected Fields</h4>
        <div className="flex flex-wrap gap-1">
          {hasWbs && <Badge variant="secondary" className="text-[10px]">WBS</Badge>}
          <Badge variant="secondary" className="text-[10px]">Name</Badge>
          <Badge variant="secondary" className="text-[10px]">Start / Finish</Badge>
          <Badge variant="secondary" className="text-[10px]">Duration</Badge>
          <Badge variant="secondary" className="text-[10px]">% Complete</Badge>
          {hasActivityId && <Badge className="text-[10px] bg-orange-100 text-orange-700 border-orange-200">Activity ID (P6)</Badge>}
          {hasCritical && <Badge variant="secondary" className="text-[10px]">Critical Path</Badge>}
          {hasResources && <Badge variant="secondary" className="text-[10px]">Resources</Badge>}
          {hasDependencies && <Badge variant="secondary" className="text-[10px]">Predecessors</Badge>}
          {hasCost && <Badge variant="secondary" className="text-[10px]">Cost</Badge>}
          {hasCalendars && <Badge variant="secondary" className="text-[10px]">Calendars</Badge>}
          {hasCodes && <Badge className="text-[10px] bg-orange-100 text-orange-700 border-orange-200">Activity Codes (P6)</Badge>}
        </div>
      </div>

      {/* ── Tabbed Data Preview ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="tasks" className="text-xs gap-1">
            <ListChecks className="h-3 w-3" /> Tasks
          </TabsTrigger>
          {data.resources.length > 0 && (
            <TabsTrigger value="resources" className="text-xs gap-1">
              <Users className="h-3 w-3" /> Resources
            </TabsTrigger>
          )}
          {hasDependencies && (
            <TabsTrigger value="dependencies" className="text-xs gap-1">
              <Link2 className="h-3 w-3" /> Dependencies
            </TabsTrigger>
          )}
          {hasCalendars && (
            <TabsTrigger value="calendars" className="text-xs gap-1">
              <CalendarDays className="h-3 w-3" /> Calendars
            </TabsTrigger>
          )}
          {hasCodes && (
            <TabsTrigger value="codes" className="text-xs gap-1">
              <Tag className="h-3 w-3" /> Activity Codes
            </TabsTrigger>
          )}
          {hasProjectInfo && (
            <TabsTrigger value="info" className="text-xs gap-1">
              <Info className="h-3 w-3" /> Project Info
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Tasks Tab ── */}
        <TabsContent value="tasks">
          <div className="border rounded-md overflow-hidden">
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[40px] text-[11px]">#</TableHead>
                    {hasActivityId && <TableHead className="text-[11px]">Act. ID</TableHead>}
                    {hasWbs && <TableHead className="text-[11px]">WBS</TableHead>}
                    <TableHead className="text-[11px]">Name</TableHead>
                    <TableHead className="text-[11px]">Start</TableHead>
                    <TableHead className="text-[11px]">Finish</TableHead>
                    <TableHead className="text-[11px]">Dur.</TableHead>
                    <TableHead className="text-[11px]">%</TableHead>
                    {hasCritical && <TableHead className="text-[11px]">Crit.</TableHead>}
                    {hasResources && <TableHead className="text-[11px]">Resources</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.tasks.slice(0, 15).map((task, idx) => (
                    <TableRow key={task.id || idx}>
                      <TableCell className="text-[11px] text-muted-foreground">{idx + 1}</TableCell>
                      {hasActivityId && (
                        <TableCell className="text-[11px] font-mono">{task.activityId || "—"}</TableCell>
                      )}
                      {hasWbs && (
                        <TableCell className="text-[11px] font-mono">{task.wbs || "—"}</TableCell>
                      )}
                      <TableCell className="text-[11px] font-medium max-w-[200px] truncate" title={task.name}>
                        {task.isMilestone && <span className="mr-1">🔷</span>}
                        {task.isSummary && <span className="mr-1">📁</span>}
                        {task.name}
                      </TableCell>
                      <TableCell className="text-[11px] font-mono text-blue-600 dark:text-blue-400">
                        {safeFormat(task.start)}
                      </TableCell>
                      <TableCell className="text-[11px] font-mono text-blue-600 dark:text-blue-400">
                        {safeFormat(task.finish)}
                      </TableCell>
                      <TableCell className="text-[11px]">{task.duration.toFixed(1)}d</TableCell>
                      <TableCell className="text-[11px]">{task.percentComplete ?? 0}%</TableCell>
                      {hasCritical && (
                        <TableCell className="text-[11px]">
                          {task.isCritical ? <span className="text-red-500">🔴</span> : "—"}
                        </TableCell>
                      )}
                      {hasResources && (
                        <TableCell className="text-[11px] max-w-[150px] truncate" title={task.resources}>
                          {task.resources || "—"}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {data.tasks.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-4 text-muted-foreground text-sm">
                        No tasks found.
                      </TableCell>
                    </TableRow>
                  )}
                  {data.tasks.length > 15 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-2 text-[11px] text-muted-foreground bg-muted/30">
                        ... and {data.tasks.length - 15} more tasks
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ── Resources Tab ── */}
        <TabsContent value="resources">
          <div className="border rounded-md overflow-hidden">
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-[11px]">Name</TableHead>
                    <TableHead className="text-[11px]">Type</TableHead>
                    <TableHead className="text-[11px]">Group</TableHead>
                    <TableHead className="text-[11px]">Email</TableHead>
                    <TableHead className="text-[11px]">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.resources.slice(0, 15).map((res, idx) => (
                    <TableRow key={res.id || idx}>
                      <TableCell className="text-[11px] font-medium">{res.name}</TableCell>
                      <TableCell className="text-[11px]">{res.type || "—"}</TableCell>
                      <TableCell className="text-[11px]">{res.group || "—"}</TableCell>
                      <TableCell className="text-[11px]">{res.email || "—"}</TableCell>
                      <TableCell className="text-[11px] font-mono">{res.standardRate || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {data.resources.length > 15 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-2 text-[11px] text-muted-foreground bg-muted/30">
                        ... and {data.resources.length - 15} more resources
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ── Dependencies Tab ── */}
        <TabsContent value="dependencies">
          <div className="border rounded-md overflow-hidden">
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-[11px]">Task</TableHead>
                    <TableHead className="text-[11px]">Predecessor</TableHead>
                    <TableHead className="text-[11px]">Type</TableHead>
                    <TableHead className="text-[11px]">Lag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data.dependencies ?? []).slice(0, 15).map((dep, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-[11px] max-w-[200px] truncate" title={dep.taskName}>
                        {dep.taskName}
                      </TableCell>
                      <TableCell className="text-[11px] max-w-[200px] truncate" title={dep.predecessorName}>
                        {dep.predecessorName}
                      </TableCell>
                      <TableCell className="text-[11px]">
                        <Badge variant="outline" className="text-[10px]">{dep.type}</Badge>
                      </TableCell>
                      <TableCell className="text-[11px] font-mono">{dep.lag}</TableCell>
                    </TableRow>
                  ))}
                  {(data.dependencies?.length ?? 0) > 15 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-2 text-[11px] text-muted-foreground bg-muted/30">
                        ... and {(data.dependencies?.length ?? 0) - 15} more dependencies
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ── Calendars Tab ── */}
        <TabsContent value="calendars">
          <div className="border rounded-md overflow-hidden">
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-[11px]">Name</TableHead>
                    <TableHead className="text-[11px]">Type</TableHead>
                    <TableHead className="text-[11px]">Parent</TableHead>
                    <TableHead className="text-[11px]">Exceptions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data.calendars ?? []).map((cal, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-[11px] font-medium">{cal.name}</TableCell>
                      <TableCell className="text-[11px]">{cal.type || "—"}</TableCell>
                      <TableCell className="text-[11px]">{cal.parentCalendar || "—"}</TableCell>
                      <TableCell className="text-[11px] max-w-[300px] truncate" title={cal.exceptions}>
                        {cal.exceptions || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ── Activity Codes Tab (P6) ── */}
        <TabsContent value="codes">
          <div className="border rounded-md overflow-hidden">
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-[11px]">Code Name</TableHead>
                    <TableHead className="text-[11px]">Value</TableHead>
                    <TableHead className="text-[11px]">Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data.activityCodes ?? []).slice(0, 20).map((ac, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-[11px] font-medium">{ac.codeName}</TableCell>
                      <TableCell className="text-[11px]">{ac.value}</TableCell>
                      <TableCell className="text-[11px]">{ac.description || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {(data.activityCodes?.length ?? 0) > 20 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-2 text-[11px] text-muted-foreground bg-muted/30">
                        ... and {(data.activityCodes?.length ?? 0) - 20} more codes
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ── Project Info Tab ── */}
        <TabsContent value="info">
          <div className="border rounded-md overflow-hidden">
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableBody>
                  {Object.entries(data.projectInfo ?? {})
                    .filter(([, v]) => v && v !== "null" && v !== "None" && v !== "")
                    .map(([key, val]) => (
                      <TableRow key={key}>
                        <TableCell className="text-[11px] font-semibold w-[180px]">{key}</TableCell>
                        <TableCell className="text-[11px]">{val}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Action Buttons ── */}
      <div className="flex justify-end gap-2 pt-2">
        {onDownload && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-3.5 w-3.5" />
                Download As
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onDownload("json")}>
                📄 JSON (full data)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDownload("xml")}>
                📋 MS Project XML
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDownload("xlsx")}>
                📊 Excel (all sheets)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDownload("pmxml")}>
                🏗️ Primavera PMXML
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={onConfirm} className="bg-green-600 hover:bg-green-700 text-white">
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Confirm Import ({data.tasks.length} tasks)
        </Button>
      </div>
    </div>
  );
}
