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
import type { ProjectState, GanttSettings } from "@/lib/types";
import { useState, useMemo, useRef, useEffect } from "react";
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
import { Loader2, Printer } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { startOfDay, addDays } from "date-fns";
import { Switch } from "@/components/ui/switch";

export function PDFExportDialog({
  open,
  onOpenChange,
  projectState,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectState: ProjectState;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [paperSize, setPaperSize] = useState<'a4' | 'letter' | 'legal'>('a4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [includeTaskTable, setIncludeTaskTable] = useState(true);
  const exportRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Temporary settings for the export view
  const exportProjectState = useMemo(() => {
    return {
        ...projectState,
        // We can override settings here if needed, e.g. hiding certain columns if user desires
        // For now, we just pass the state as is, but maybe force disable virtualization if the component supported it
    };
  }, [projectState]);

  const handleExport = async () => {
    if (!exportRef.current) return;
    setIsExporting(true);

    try {
        // Wait a moment for any potential renders
        await new Promise(resolve => setTimeout(resolve, 500));

        const canvas = await html2canvas(exportRef.current, {
            scale: 2, // Higher scale for better quality
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        } as any);

        const imgData = canvas.toDataURL('image/png');

        // Initialize jsPDF
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

        // First page
        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
        heightLeft -= availableHeight;

        // Additional pages if the content is taller than one page
        while (heightLeft > 0) {
             pdf.addPage();
             // Shift the image up by the height of pages already printed
             const yPos = margin - (imgHeight - heightLeft);
             pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
             heightLeft -= availableHeight;
        }

        pdf.save(`project-export-${new Date().toISOString().split('T')[0]}.pdf`);
        onOpenChange(false);
    } catch (error) {
        console.error("Export failed:", error);
    } finally {
        setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
            "flex flex-col",
             isMobile ? "h-dvh max-h-dvh w-screen max-w-screen rounded-none border-none p-0" : "max-w-7xl h-[90vh]"
        )}>
        <DialogHeader className={cn("px-6 py-4 border-b", isMobile && "px-4")}>
          <DialogTitle>PDF Export Preview</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col md:flex-row h-full overflow-hidden">
            {/* Settings Sidebar */}
            <div className={cn(
                "w-full md:w-64 bg-muted/30 p-4 border-b md:border-b-0 md:border-r flex flex-col gap-4 overflow-y-auto",
                isMobile && "h-auto max-h-[30vh]"
            )}>
                <div className="space-y-2">
                    <Label>Paper Size</Label>
                    <Select value={paperSize} onValueChange={(v: any) => setPaperSize(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="a4">A4</SelectItem>
                            <SelectItem value="letter">Letter</SelectItem>
                            <SelectItem value="legal">Legal</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Orientation</Label>
                    <Select value={orientation} onValueChange={(v: any) => setOrientation(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="portrait">Portrait</SelectItem>
                            <SelectItem value="landscape">Landscape</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center justify-between">
                    <Label htmlFor="include-table">Include Table</Label>
                    <Switch
                        id="include-table"
                        checked={includeTaskTable}
                        onCheckedChange={setIncludeTaskTable}
                    />
                </div>

                <div className="text-xs text-muted-foreground mt-4">
                    <p>Preview shows the full content. On export, the content will be scaled to fit the selected paper width.</p>
                </div>
            </div>

            {/* Preview Area */}
            <div className="flex-1 bg-muted/10 overflow-auto p-4 relative flex justify-center">
                 <div className="min-w-fit h-fit bg-background shadow-lg p-4 origin-top">
                     {/*
                        We render the GanttChart here.
                        We use a ref to capture it.
                        We pass disableScroll={true} to make it fully expanded.
                     */}
                     <div ref={exportRef} id="gantt-export-wrapper" className="w-fit min-w-[800px] max-w-[2000px]">
                        <div className="mb-4">
                             <h1 className="text-2xl font-bold">{projectState.tasks[0]?.projectName || "Project Export"}</h1>
                             <p className="text-sm text-muted-foreground">Generated on {new Date().toLocaleDateString()}</p>
                        </div>
                        <GanttChart
                            projectState={includeTaskTable ? exportProjectState : {
                                ...exportProjectState,
                                visibleColumns: [] // Hide all columns if table is disabled? Or we can hack CSS.
                                // Actually, if we want to hide the table, modifying GanttChart to accept 'hideTable' prop would be best,
                                // but for now, we can just let 'disableScroll' handle the layout and maybe CSS hide the table column?
                                // Let's stick to simple "disableScroll" which renders both side-by-side.
                                // If includeTaskTable is false, we might want to hide the left side.
                            }}
                            dispatch={() => {}}
                            uiDensity={projectState.uiDensity}
                            disableScroll={true}
                        />
                        {/*
                            If includeTaskTable is false, we can use CSS to hide the first child of the flex container
                            rendered by GanttChart when disableScroll is true.
                        */}
                        {!includeTaskTable && (
                            <style jsx global>{`
                                div[ref="${exportRef.current}"] .bg-card > div:first-child {
                                    display: none;
                                }
                            `}</style>
                        )}
                         {/* A better way to hide table without global CSS pollution: */}
                         <style>{`
                            ${!includeTaskTable ? `
                                #gantt-export-wrapper .bg-card > div:first-child { display: none !important; }
                            ` : ''}
                         `}</style>
                     </div>
                 </div>
            </div>
        </div>

        <DialogFooter className="p-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            Export PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
