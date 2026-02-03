'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GanttChart } from "@/components/omni-gantt/gantt-chart";
import type { ProjectState } from "@/lib/types";
import { useState, useMemo, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "./ui/label";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Loader2, Printer, FileDown, FileSpreadsheet, TableProperties } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useRenderableRows } from "@/hooks/use-renderable-rows";
import { exportToCSV, exportToExcel } from "@/lib/export-utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function ExportDialog({
  open,
  onOpenChange,
  projectState,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectState: ProjectState;
}) {
  const [format, setFormat] = useState<'pdf' | 'csv' | 'xlsx'>('pdf');
  const [content, setContent] = useState<'both' | 'table' | 'gantt'>('both');

  const [isExporting, setIsExporting] = useState(false);
  const [paperSize, setPaperSize] = useState<'a4' | 'letter' | 'legal'>('a4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');

  const exportRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Get data for CSV/Excel export
  const { renderableRows } = useRenderableRows(projectState);

  // Temporary settings for the export view
  const exportProjectState = useMemo(() => {
    return {
        ...projectState,
    };
  }, [projectState]);

  const handleExport = async () => {
    setIsExporting(true);

    try {
        const filename = `project-export-${new Date().toISOString().split('T')[0]}`;

        if (format === 'csv' || format === 'xlsx') {
            const tasks = renderableRows
                .filter(r => r.itemType === 'task')
                .map(r => r.data);

            if (format === 'csv') {
                exportToCSV(
                    tasks,
                    projectState.columns,
                    projectState.visibleColumns,
                    projectState.assignments,
                    projectState.resources,
                    filename
                );
            } else {
                exportToExcel(
                    tasks,
                    projectState.columns,
                    projectState.visibleColumns,
                    projectState.assignments,
                    projectState.resources,
                    filename
                );
            }
            onOpenChange(false);
            return;
        }

        // PDF Export
        if (!exportRef.current) return;

        // Wait a moment for any potential renders
        await new Promise(resolve => setTimeout(resolve, 500));

        const canvas = await html2canvas(exportRef.current, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        } as any);

        const imgData = canvas.toDataURL('image/png');

        const pdf = new jsPDF({
            orientation: orientation,
            unit: 'mm',
            format: paperSize,
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const availableWidth = pageWidth - (margin * 2);
        const availableHeight = pageHeight - (margin * 2);

        const imgWidth = availableWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;

        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
        heightLeft -= availableHeight;

        while (heightLeft > 0) {
             pdf.addPage();
             const yPos = margin - (imgHeight - heightLeft);
             pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
             heightLeft -= availableHeight;
        }

        pdf.save(`${filename}.pdf`);
        onOpenChange(false);
    } catch (error) {
        console.error("Export failed:", error);
    } finally {
        setIsExporting(false);
    }
  };

  const previewShowTable = format === 'pdf' ? (content !== 'gantt') : true;
  const previewShowTimeline = format === 'pdf' ? (content !== 'table') : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
            "flex flex-col",
             isMobile ? "h-dvh max-h-dvh w-screen max-w-screen rounded-none border-none p-0" : "max-w-7xl h-[90vh]"
        )}>
        <DialogHeader className={cn("px-6 py-4 border-b", isMobile && "px-4")}>
          <DialogTitle>Export Project</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col md:flex-row h-full overflow-hidden">
            <div className={cn(
                "w-full md:w-64 bg-muted/30 p-4 border-b md:border-b-0 md:border-r flex flex-col gap-6 overflow-y-auto",
                isMobile && "h-auto max-h-[40vh]"
            )}>
                <div className="space-y-3">
                    <Label className="text-base font-semibold">Format</Label>
                    <RadioGroup value={format} onValueChange={(v: any) => setFormat(v)} className="grid grid-cols-1 gap-2">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="pdf" id="format-pdf" />
                            <Label htmlFor="format-pdf" className="flex items-center cursor-pointer font-normal">
                                <FileDown className="mr-2 h-4 w-4" /> PDF
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="csv" id="format-csv" />
                            <Label htmlFor="format-csv" className="flex items-center cursor-pointer font-normal">
                                <TableProperties className="mr-2 h-4 w-4" /> CSV
                            </Label>
                        </div>
                         <div className="flex items-center space-x-2">
                            <RadioGroupItem value="xlsx" id="format-xlsx" />
                            <Label htmlFor="format-xlsx" className="flex items-center cursor-pointer font-normal">
                                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
                            </Label>
                        </div>
                    </RadioGroup>
                </div>

                {format === 'pdf' && (
                    <>
                        <div className="space-y-3">
                            <Label className="text-base font-semibold">Content</Label>
                             <Select value={content} onValueChange={(v: any) => setContent(v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="both">Both Table & Gantt</SelectItem>
                                    <SelectItem value="table">Table Only</SelectItem>
                                    <SelectItem value="gantt">Gantt Only</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-base font-semibold">Paper Settings</Label>
                            <div className="grid grid-cols-1 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Size</Label>
                                    <Select value={paperSize} onValueChange={(v: any) => setPaperSize(v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="a4">A4</SelectItem>
                                            <SelectItem value="letter">Letter</SelectItem>
                                            <SelectItem value="legal">Legal</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Orientation</Label>
                                    <Select value={orientation} onValueChange={(v: any) => setOrientation(v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="portrait">Portrait</SelectItem>
                                            <SelectItem value="landscape">Landscape</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                <div className="text-xs text-muted-foreground mt-auto">
                    {format === 'pdf' ? (
                        <p>Preview shows the full content. On export, the content will be scaled to fit the selected paper.</p>
                    ) : (
                        <p>Exporting the current view columns and filters.</p>
                    )}
                </div>
            </div>

            <div className="flex-1 bg-muted/10 overflow-auto p-4 relative flex justify-center">
                 <div className="min-w-fit h-fit bg-background shadow-lg p-4 origin-top">
                     <div ref={exportRef} id="export-wrapper" className="w-fit min-w-[800px] max-w-[2000px]">
                        <div className="mb-4">
                             <h1 className="text-2xl font-bold">{projectState.tasks[0]?.projectName || "Project Export"}</h1>
                             <p className="text-sm text-muted-foreground">Generated on {new Date().toLocaleDateString()}</p>
                        </div>
                        <GanttChart
                            projectState={exportProjectState}
                            dispatch={() => {}}
                            uiDensity={projectState.uiDensity}
                            disableScroll={true}
                            showTable={previewShowTable}
                            showTimeline={previewShowTimeline}
                        />
                     </div>
                 </div>
            </div>
        </div>

        <DialogFooter className="p-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {!isExporting && format === 'pdf' && <Printer className="mr-2 h-4 w-4" />}
            {!isExporting && format !== 'pdf' && <FileDown className="mr-2 h-4 w-4" />}
            Export {format.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
