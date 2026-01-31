'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarView } from "./calendar-view";
import type { ProjectState } from "@/lib/types";

export function CalendarManagementDialog({
  open,
  onOpenChange,
  projectState,
  dispatch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectState: ProjectState;
  dispatch: any;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-full sm:h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Calendar Management</DialogTitle>
        </DialogHeader>
        <div className="flex-grow overflow-auto pr-6">
            <CalendarView projectState={projectState} dispatch={dispatch} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
