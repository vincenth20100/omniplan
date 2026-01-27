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
  history: ProjectState[];
  dispatch: any;
}) {

  const handleHistoryClick = (index: number) => {
    const stepsToUndo = history.length - 1 - index;
    if (stepsToUndo <= 0) return;
    for (let i = 0; i < stepsToUndo; i++) {
      dispatch({ type: 'UNDO' });
    }
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Action History</SheetTitle>
          <SheetDescription>
            A log of all your changes. Click an action to revert the project to that state.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
            <div className="flex flex-col gap-1 pr-4">
                {history.length > 0 ? (
                    history.slice().reverse().map((pastState, index) => {
                        const originalIndex = history.length - 1 - index;
                        // The last entry in the log corresponds to the action that produced this state
                        const logEntry = pastState.historyLog[pastState.historyLog.length - 1];
                        if (!logEntry) return null;
                        
                        const description = getActionDescription(logEntry.action);

                        return (
                            <Button 
                                key={originalIndex}
                                variant="ghost"
                                className="h-auto flex flex-col items-start"
                                onClick={() => handleHistoryClick(originalIndex)}
                            >
                                <p className="font-medium capitalize text-sm text-left">{description}</p>
                                <p className="text-xs text-muted-foreground self-start">
                                    {formatDistanceToNow(new Date(logEntry.timestamp), { addSuffix: true })}
                                </p>
                            </Button>
                        )
                    })
                ) : (
                    <div className="text-center text-sm text-muted-foreground p-8">No history yet.</div>
                )}
                 <div className="p-2">
                    <p className="font-medium capitalize text-sm">Project Initialized</p>
                </div>
            </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
