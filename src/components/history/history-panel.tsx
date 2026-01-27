'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { ProjectState } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from 'date-fns';
import { Button } from "../ui/button";

function getActionDescription(action: any): string {
    const type = action.type.replace(/_/g, ' ').toLowerCase();
    let details = '';

    if (action.payload?.name) {
        details = `"${action.payload.name}"`;
    } else if (action.payload?.taskId) {
        details = `task`;
    } else if (action.payload?.linkId) {
        details = `link`;
    } else if (action.type === 'LINK_TASKS') {
        details = 'tasks';
    }

    return `${type} ${details}`.trim();
}

export function HistoryPanel({
  open,
  onOpenChange,
  history,
  dispatch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: any[];
  dispatch: any;
}) {

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Action History</SheetTitle>
          <SheetDescription>
            A log of all your changes. This is currently disabled.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
            <div className="text-center text-sm text-muted-foreground p-8">
                History is disabled now that data is live from the database. A new versioning system will be added in the future.
            </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
