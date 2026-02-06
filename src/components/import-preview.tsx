import React from "react";
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
import { CheckCircle2 } from "lucide-react";

interface ImportPreviewProps {
  data: ImportedProjectData;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ImportPreview({ data, onCancel, onConfirm }: ImportPreviewProps) {
  // Determine available columns based on the first few tasks
  const sampleTasks = data.tasks.slice(0, 20); // Check first 20 for data presence

  // Define potential columns to check for
  const potentialColumns = [
    { key: 'wbs', label: 'WBS' },
    { key: 'name', label: 'Name' },
    { key: 'start', label: 'Start Date' },
    { key: 'finish', label: 'Finish Date' },
    { key: 'duration', label: 'Duration' },
    { key: 'percentComplete', label: '% Complete' },
    { key: 'isSummary', label: 'Is Summary' },
  ];

  const detectedFields = potentialColumns.filter(col =>
    sampleTasks.some(t => {
      const val = t[col.key as keyof typeof t];
      return val !== undefined && val !== null && val !== '';
    })
  );

  return (
    <div className="flex flex-col gap-6 py-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-none border-dashed">
           <CardHeader className="pb-2 py-3"><CardTitle className="text-xs uppercase text-muted-foreground font-semibold">Project Name</CardTitle></CardHeader>
           <CardContent className="py-2"><div className="text-lg font-bold truncate" title={data.name}>{data.name}</div></CardContent>
        </Card>
        <Card className="shadow-none border-dashed">
           <CardHeader className="pb-2 py-3"><CardTitle className="text-xs uppercase text-muted-foreground font-semibold">Tasks</CardTitle></CardHeader>
           <CardContent className="py-2"><div className="text-lg font-bold">{data.tasks.length}</div></CardContent>
        </Card>
        <Card className="shadow-none border-dashed">
           <CardHeader className="pb-2 py-3"><CardTitle className="text-xs uppercase text-muted-foreground font-semibold">Resources</CardTitle></CardHeader>
           <CardContent className="py-2"><div className="text-lg font-bold">{data.resources.length}</div></CardContent>
        </Card>
      </div>

      <div className="space-y-2">
         <h3 className="text-sm font-semibold">Detected Columns</h3>
         <div className="flex flex-wrap gap-2">
            {detectedFields.map(field => (
                <Badge key={field.key} variant="secondary" className="font-normal">{field.label}</Badge>
            ))}
         </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Task Preview (First 5 Rows)</h3>
            <span className="text-xs text-muted-foreground">Verify date formats (YYYY-MM-DD HH:mm)</span>
        </div>

        <div className="border rounded-md overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>Finish</TableHead>
                        <TableHead>Dur.</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.tasks.slice(0, 5).map((task, idx) => (
                        <TableRow key={task.id || idx}>
                            <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-medium max-w-[200px] truncate" title={task.name}>{task.name}</TableCell>
                            <TableCell className="text-xs font-mono text-blue-600 dark:text-blue-400">
                                {format(task.start, 'yyyy-MM-dd HH:mm')}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-blue-600 dark:text-blue-400">
                                {format(task.finish, 'yyyy-MM-dd HH:mm')}
                            </TableCell>
                            <TableCell className="text-xs">{task.duration.toFixed(1)}d</TableCell>
                        </TableRow>
                    ))}
                    {data.tasks.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                                No tasks found in import.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
         <Button variant="outline" onClick={onCancel}>Cancel</Button>
         <Button onClick={onConfirm} className="bg-green-600 hover:bg-green-700 text-white">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Confirm Import
         </Button>
      </div>
    </div>
  );
}
