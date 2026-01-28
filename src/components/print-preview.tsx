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
import { useState, useMemo, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "./ui/label";

export function PrintPreviewDialog({
  open,
  onOpenChange,
  projectState,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectState: ProjectState;
}) {
  const [printSettings, setPrintSettings] = useState<GanttSettings>(projectState.ganttSettings);

  useEffect(() => {
      // Reset settings when dialog opens
      if (open) {
          setPrintSettings(projectState.ganttSettings);
      }
  }, [open, projectState.ganttSettings]);

  const previewProjectState = useMemo(() => ({
    ...projectState,
    ganttSettings: printSettings,
  }), [projectState, printSettings]);

  const handlePrint = () => {
      // Temporarily add a class to the body to trigger print-specific styles
      document.body.classList.add('printing-preview');
      window.print();
      // Remove the class after printing is initiated
      // Use a timeout to ensure it's removed after the print dialog has opened
      setTimeout(() => {
        document.body.classList.remove('printing-preview');
      }, 500);
  };

  const handleSettingChange = (key: keyof GanttSettings, value: any) => {
      setPrintSettings(prev => ({...prev, [key]: value}));
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[90vh] flex flex-col" data-radix-dialog-content>
        <DialogHeader id="print-preview-dialog-header">
          <DialogTitle>Print Preview</DialogTitle>
        </DialogHeader>
        
        <div id="print-preview-dialog-controls" className="grid grid-cols-4 gap-4 items-center border-b pb-4">
            <div>
                <Label htmlFor="view-mode">Timeline Scale</Label>
                <Select
                    value={printSettings.viewMode}
                    onValueChange={(value: 'day' | 'week' | 'month') => handleSettingChange('viewMode', value)}
                  >
                    <SelectTrigger id="view-mode">
                      <SelectValue placeholder="Select view mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Day</SelectItem>
                      <SelectItem value="week">Week</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        <div className="flex-grow overflow-auto border rounded-md" id="printable-area">
           <GanttChart projectState={previewProjectState} dispatch={() => {}} uiDensity={projectState.uiDensity} />
        </div>

        <DialogFooter id="print-preview-dialog-footer">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handlePrint}>Print to PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
