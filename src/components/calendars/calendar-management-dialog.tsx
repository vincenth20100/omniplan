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
      <DialogContent className="flex flex-col h-full sm:max-w-4xl sm:h-[80vh]">
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
