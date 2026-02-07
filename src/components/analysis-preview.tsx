import React, { useState } from "react";
import { HFAnalyzeResponse } from "@/lib/omniplan-utils";
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
  CheckCircle2,
  ListChecks,
  Users,
  Link2,
  CalendarDays,
  Tag,
  Info,
} from "lucide-react";

interface AnalysisPreviewProps {
  data: HFAnalyzeResponse;
  fileName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function AnalysisPreview({
  data,
  fileName,
  onCancel,
  onConfirm,
}: AnalysisPreviewProps) {
  const [activeTab, setActiveTab] = useState("tasks");

  const tasks = data.tasks || [];
  const resources = data.resources || [];
  const dependencies = data.predecessors || [];
  const calendars = data.calendars || [];
  const projectInfo = data.project_info || {};
  const activityCodes = data.activity_codes || [];

  const hasTasks = tasks.length > 0;
  const hasResources = resources.length > 0;
  const hasDependencies = dependencies.length > 0;
  const hasCalendars = calendars.length > 0;
  const hasProjectInfo = Object.keys(projectInfo).length > 0;
  const hasActivityCodes = activityCodes.length > 0;

  // Helper to safely format dates if they are strings
  // The API returns strings, sometimes ISO, sometimes human readable.
  // We'll just display them as-is mostly, or try simple parsing if needed.
  // Since this is a "Review" of raw data, showing raw strings is acceptable/preferred.
  const formatVal = (val: string | undefined) => val || "—";

  return (
    <div className="flex flex-col gap-4 py-2">
      {/* ── Summary Bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="shadow-none border-dashed">
          <CardHeader className="pb-1 py-2">
            <CardTitle className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
              File
            </CardTitle>
          </CardHeader>
          <CardContent className="py-1">
            <div className="text-sm font-bold truncate" title={fileName}>
              {fileName}
            </div>
            {projectInfo["Project Title"] && (
              <div className="text-[10px] text-muted-foreground truncate">
                {projectInfo["Project Title"]}
              </div>
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
            <div className="text-lg font-bold">{tasks.length}</div>
            <div className="text-[10px] text-muted-foreground">
              {tasks.filter((t) => t["Milestone"] === "true").length} milestones
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none border-dashed">
          <CardHeader className="pb-1 py-2">
            <CardTitle className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
              Resources
            </CardTitle>
          </CardHeader>
          <CardContent className="py-1">
            <div className="text-lg font-bold">{resources.length}</div>
          </CardContent>
        </Card>

        <Card className="shadow-none border-dashed">
          <CardHeader className="pb-1 py-2">
            <CardTitle className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
              Dependencies
            </CardTitle>
          </CardHeader>
          <CardContent className="py-1">
            <div className="text-lg font-bold">{dependencies.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="tasks" className="text-xs gap-1">
            <ListChecks className="h-3 w-3" /> Tasks
          </TabsTrigger>
          {hasResources && (
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
          {hasActivityCodes && (
            <TabsTrigger value="codes" className="text-xs gap-1">
              <Tag className="h-3 w-3" /> Codes
            </TabsTrigger>
          )}
          {hasProjectInfo && (
            <TabsTrigger value="info" className="text-xs gap-1">
              <Info className="h-3 w-3" /> Info
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Tasks Content ── */}
        <TabsContent value="tasks">
          <div className="border rounded-md overflow-hidden">
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[60px] text-[11px]">ID</TableHead>
                    <TableHead className="text-[11px]">Task Name</TableHead>
                    <TableHead className="text-[11px]">Duration</TableHead>
                    <TableHead className="text-[11px]">Start</TableHead>
                    <TableHead className="text-[11px]">Finish</TableHead>
                    <TableHead className="text-[11px]">Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.slice(0, 50).map((t, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-[11px] font-mono text-muted-foreground">
                        {formatVal(t["Unique ID"] || t["ID"])}
                      </TableCell>
                      <TableCell className="text-[11px] font-medium max-w-[250px] truncate" title={t["Task Name"]}>
                        {t["Summary"] === "true" && <span className="mr-1">📁</span>}
                        {t["Milestone"] === "true" && <span className="mr-1">🔷</span>}
                        {formatVal(t["Task Name"])}
                      </TableCell>
                      <TableCell className="text-[11px]">{formatVal(t["Duration"])}</TableCell>
                      <TableCell className="text-[11px] font-mono text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {formatVal(t["Start"])}
                      </TableCell>
                      <TableCell className="text-[11px] font-mono text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {formatVal(t["Finish"])}
                      </TableCell>
                      <TableCell className="text-[11px] text-center">{formatVal(t["Outline Level"])}</TableCell>
                    </TableRow>
                  ))}
                  {tasks.length > 50 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-2 text-[11px] text-muted-foreground bg-muted/30">
                        ... and {tasks.length - 50} more tasks
                      </TableCell>
                    </TableRow>
                  )}
                  {tasks.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No tasks found in analysis.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ── Resources Content ── */}
        <TabsContent value="resources">
          <div className="border rounded-md overflow-hidden">
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[60px] text-[11px]">ID</TableHead>
                    <TableHead className="text-[11px]">Name</TableHead>
                    <TableHead className="text-[11px]">Type</TableHead>
                    <TableHead className="text-[11px]">Email</TableHead>
                    <TableHead className="text-[11px]">Group</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resources.slice(0, 50).map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-[11px] font-mono text-muted-foreground">
                        {formatVal(r["Unique ID"] || r["ID"])}
                      </TableCell>
                      <TableCell className="text-[11px] font-medium">{formatVal(r["Name"])}</TableCell>
                      <TableCell className="text-[11px]">{formatVal(r["Type"])}</TableCell>
                      <TableCell className="text-[11px]">{formatVal(r["Email"])}</TableCell>
                      <TableCell className="text-[11px]">{formatVal(r["Group"])}</TableCell>
                    </TableRow>
                  ))}
                  {resources.length > 50 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-2 text-[11px] text-muted-foreground bg-muted/30">
                        ... and {resources.length - 50} more resources
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ── Dependencies Content ── */}
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
                  {dependencies.slice(0, 50).map((d, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-[11px] max-w-[200px] truncate" title={d["Task Name"]}>
                         <span className="font-mono text-muted-foreground mr-2">{d["Task ID"]}</span>
                         {formatVal(d["Task Name"])}
                      </TableCell>
                      <TableCell className="text-[11px] max-w-[200px] truncate" title={d["Predecessor Name"]}>
                         <span className="font-mono text-muted-foreground mr-2">{d["Predecessor ID"]}</span>
                         {formatVal(d["Predecessor Name"])}
                      </TableCell>
                      <TableCell className="text-[11px]">
                        <Badge variant="outline" className="text-[10px]">{formatVal(d["Type"])}</Badge>
                      </TableCell>
                      <TableCell className="text-[11px] font-mono">{formatVal(d["Lag"])}</TableCell>
                    </TableRow>
                  ))}
                  {dependencies.length > 50 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-2 text-[11px] text-muted-foreground bg-muted/30">
                        ... and {dependencies.length - 50} more dependencies
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ── Calendars Content ── */}
        <TabsContent value="calendars">
          <div className="border rounded-md overflow-hidden">
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-[11px]">Name</TableHead>
                    <TableHead className="text-[11px]">Type</TableHead>
                    <TableHead className="text-[11px]">Parent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calendars.map((c, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-[11px] font-medium">{formatVal(c["Name"])}</TableCell>
                      <TableCell className="text-[11px]">{formatVal(c["Type"])}</TableCell>
                      <TableCell className="text-[11px]">{formatVal(c["Parent Calendar"])}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ── Codes Content ── */}
        <TabsContent value="codes">
          <div className="border rounded-md overflow-hidden">
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-[11px]">Code</TableHead>
                    <TableHead className="text-[11px]">Value</TableHead>
                    <TableHead className="text-[11px]">Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityCodes.slice(0, 50).map((ac, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-[11px] font-medium">{formatVal(ac["Code Name"])}</TableCell>
                      <TableCell className="text-[11px]">{formatVal(ac["Value"])}</TableCell>
                      <TableCell className="text-[11px]">{formatVal(ac["Description"])}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ── Info Content ── */}
        <TabsContent value="info">
          <div className="border rounded-md overflow-hidden">
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableBody>
                  {Object.entries(projectInfo).map(([key, val]) => (
                    <TableRow key={key}>
                      <TableCell className="text-[11px] font-semibold w-[150px]">{key}</TableCell>
                      <TableCell className="text-[11px]">{val}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Footer ── */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onConfirm} className="bg-green-600 hover:bg-green-700 text-white">
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Confirm Import
        </Button>
      </div>
    </div>
  );
}
