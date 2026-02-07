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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuSeparator, DropdownMenuTrigger,
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

  // Feature detection
  const hasDependencies = (data.dependencies?.length ?? 0) > 0;
  const hasResources    = (data.resources?.length ?? 0) > 0;
  const hasCalendars    = (data.calendars?.length ?? 0) > 0;
  const hasProjectInfo  = data.projectInfo && Object.keys(data.projectInfo).length > 0;
  
  // Check for P6/Advanced fields in tasks
  const sampleTasks     = data.tasks.slice(0, 50);
  const hasActivityId   = sampleTasks.some(t => t.activityId);
  const hasWbs          = sampleTasks.some(t => t.wbs);
  const hasCustomFields = sampleTasks.some(t => t.customText && Object.keys(t.customText).length > 0);
  const activityCodes   = data.activityCodes || [];

  const safeFormat = (d: Date | undefined | null) => {
    if (!d || isNaN(d.getTime())) return "—";
    return format(d, "MMM dd, yyyy");
  };

  return (
    <div className="flex flex-col gap-4 py-2 animate-in fade-in duration-500">
      
      {/* ── Stats Header ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Project" value={data.name} icon={<FileText className="h-4 w-4 text-blue-500"/>} sub={data.sourceFormat} />
        <StatCard title="Tasks" value={data.tasks.length} icon={<ListChecks className="h-4 w-4 text-green-500"/>} sub={`${data.tasks.filter(t => t.isMilestone).length} milestones`} />
        <StatCard title="Resources" value={data.resources.length} icon={<Users className="h-4 w-4 text-orange-500"/>} />
        <StatCard title="Dependencies" value={data.dependencies.length} icon={<Link2 className="h-4 w-4 text-purple-500"/>} />
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start h-10 bg-muted/40 p-1">
          <TabsTrigger value="tasks" className="text-xs gap-2"><ListChecks className="h-3 w-3"/> Tasks</TabsTrigger>
          {hasResources && <TabsTrigger value="resources" className="text-xs gap-2"><Users className="h-3 w-3"/> Resources</TabsTrigger>}
          {hasDependencies && <TabsTrigger value="dependencies" className="text-xs gap-2"><Link2 className="h-3 w-3"/> Dependencies</TabsTrigger>}
          {hasCalendars && <TabsTrigger value="calendars" className="text-xs gap-2"><CalendarDays className="h-3 w-3"/> Calendars</TabsTrigger>}
          {(activityCodes.length > 0) && <TabsTrigger value="codes" className="text-xs gap-2"><Tag className="h-3 w-3"/> Activity Codes</TabsTrigger>}
          {hasProjectInfo && <TabsTrigger value="info" className="text-xs gap-2"><Info className="h-3 w-3"/> Project Info</TabsTrigger>}
        </TabsList>

        <div className="mt-2 border rounded-lg bg-card shadow-sm min-h-[400px]">
          
          {/* ── Tasks Content ── */}
          <TabsContent value="tasks" className="m-0 p-0">
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/90 z-10 backdrop-blur-sm">
                  <TableRow>
                    <TableHead className="w-[50px] text-[11px]">#</TableHead>
                    {hasActivityId && <TableHead className="text-[11px] text-blue-700">Activity ID</TableHead>}
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
                  {data.tasks.slice(0, 100).map((t, i) => (
                    <TableRow key={t.id || i} className="hover:bg-muted/30">
                      <TableCell className="text-[10px] text-muted-foreground">{i + 1}</TableCell>
                      {hasActivityId && <TableCell className="text-[11px] font-mono text-blue-600">{t.activityId || "-"}</TableCell>}
                      {hasWbs && <TableCell className="text-[10px] font-mono text-muted-foreground">{t.wbs}</TableCell>}
                      <TableCell className="text-[12px] font-medium max-w-[300px] truncate">
                        <div className="flex items-center gap-1.5">
                            {t.isMilestone && <div className="h-2 w-2 rotate-45 bg-purple-500 rounded-[1px]" title="Milestone"/>}
                            {t.isSummary && <div className="h-2 w-2 bg-slate-400" title="Summary Task"/>}
                            <span style={{ paddingLeft: `${Math.min(t.level * 10, 100)}px` }}>{t.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[11px] whitespace-nowrap">{safeFormat(t.start)}</TableCell>
                      <TableCell className="text-[11px] whitespace-nowrap">{safeFormat(t.finish)}</TableCell>
                      <TableCell className="text-[11px]">{t.duration}d</TableCell>
                      <TableCell className="text-[11px]">
                        <div className="flex items-center gap-1">
                           <div className="h-1.5 w-8 bg-slate-100 rounded-full overflow-hidden">
                             <div className="h-full bg-green-500" style={{ width: `${t.percentComplete}%` }}/>
                           </div>
                           {t.percentComplete}%
                        </div>
                      </TableCell>
                      {hasCustomFields && (
                         <TableCell className="text-[10px] text-muted-foreground max-w-[150px] truncate">
                           {t.customText ? Object.values(t.customText).join(", ") : ""}
                         </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ── Project Info Content ── */}
          <TabsContent value="info" className="m-0 p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {Object.entries(data.projectInfo).map(([key, val]) => (
                    <div key={key} className="space-y-1">
                        <h4 className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wider">{key}</h4>
                        <p className="text-sm font-medium border-b pb-1">{val}</p>
                    </div>
                ))}
            </div>
          </TabsContent>

          {/* ── Resources Content ── */}
          <TabsContent value="resources" className="m-0">
             <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/90 z-10">
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Email</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.resources.map(r => (
                        <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.name}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{r.type}</Badge></TableCell>
                            <TableCell className="text-muted-foreground">{r.email || "-"}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
              </Table>
             </div>
          </TabsContent>

          {/* ── Dependencies Content ── */}
          <TabsContent value="dependencies" className="m-0">
             {/* Use your existing dependency table logic here, it was good! */}
             <div className="p-4 text-sm text-muted-foreground text-center">
                {data.dependencies.length} links detected. (Render table here)
             </div>
          </TabsContent>

           {/* ── Activity Codes Content ── */}
           <TabsContent value="codes" className="m-0">
             <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/90 z-10">
                    <TableRow>
                        <TableHead>Field Name</TableHead>
                        <TableHead>Value / Description</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {activityCodes.map((ac, i) => (
                        <TableRow key={i}>
                            <TableCell className="font-medium">{ac.codeName}</TableCell>
                            <TableCell className="text-muted-foreground">{ac.value}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
              </Table>
             </div>
          </TabsContent>

        </div>
      </Tabs>

      {/* ── Footer Actions ── */}
      <div className="flex justify-between items-center pt-2 border-t mt-2">
        <div className="text-xs text-muted-foreground">
            Previewing <strong>{data.tasks.length}</strong> tasks from <strong>{sourceFile?.name}</strong>
        </div>
        <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
            <Button size="sm" onClick={onConfirm} className="bg-primary text-primary-foreground gap-2">
                <CheckCircle2 className="h-4 w-4"/> Import Project
            </Button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, sub }: { title: string, value: string | number, icon: React.ReactNode, sub?: string }) {
    return (
        <Card className="shadow-none border bg-muted/10">
            <CardContent className="p-3 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-background border flex items-center justify-center shadow-sm">
                    {icon}
                </div>
                <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">{title}</p>
                    <div className="text-lg font-bold leading-none">{value}</div>
                    {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
                </div>
            </CardContent>
        </Card>
    );
}
