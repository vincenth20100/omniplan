import { format } from "date-fns";
import type { PersistentHistoryEntry } from "@/lib/types";
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Info } from "lucide-react"

export const safeFormat = (val: any, fmt: string) => {
    if (!val) return '';
    let date = val;
    if (val?.toDate) date = val.toDate();
    else if (!(val instanceof Date)) date = new Date(val);

    try {
        return format(date, fmt);
    } catch (e) {
        return '';
    }
}

function HistoryDetailsViewer({ details }: { details: any }) {
    if (!details) return null;

    if (details.deletedTasks) {
        return (
            <div className="space-y-2">
                <h4 className="font-medium text-sm">Deleted Tasks:</h4>
                <ul className="list-disc list-inside text-sm max-h-[300px] overflow-y-auto">
                    {details.deletedTasks.map((t: any) => (
                        <li key={t.id}>{t.name} <span className="text-xs text-muted-foreground">({t.id})</span></li>
                    ))}
                </ul>
            </div>
        );
    }

    if (details.changes) {
        return (
            <div className="space-y-2">
                <h4 className="font-medium text-sm">Changes for {details.taskName || 'Task'}:</h4>
                <div className="grid grid-cols-3 gap-2 text-sm border rounded p-2 overflow-auto max-h-[300px]">
                    <div className="font-medium">Field</div>
                    <div className="font-medium">From</div>
                    <div className="font-medium">To</div>
                    {Object.entries(details.changes).map(([field, change]: [string, any]) => (
                        <React.Fragment key={field}>
                            <div className="capitalize">{field}</div>
                            <div className="text-muted-foreground truncate" title={String(change.from)}>{String(change.from)}</div>
                            <div className="truncate" title={String(change.to)}>{String(change.to)}</div>
                        </React.Fragment>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-2">
             <h4 className="font-medium text-sm">Details:</h4>
             <pre className="text-xs overflow-auto bg-muted p-2 rounded max-h-[300px]">
                {JSON.stringify(details, null, 2)}
            </pre>
        </div>
    );
}

export function PersistentLogList({ history }: { history: PersistentHistoryEntry[] }) {
  if (history.length === 0) {
      return <div className="text-center text-sm text-muted-foreground p-8">No history recorded.</div>;
  }

  const getActionDescription = (entry: PersistentHistoryEntry): string => {
    const type = entry.actionType.replace(/_/g, ' ').toLowerCase();
    return `${type} ${entry.payloadDescription || ''}`.trim();
  }

  return (
    <div className="mt-4">
        <div className="flex flex-col gap-4 pr-4 pb-4">
            {history.map((entry) => (
                <div key={entry.id} className="flex flex-col border-b pb-2 last:border-0">
                    <div className="flex justify-between items-start">
                        <span className="text-sm font-medium capitalize">{getActionDescription(entry)}</span>
                        <div className="flex items-center gap-1">
                            {entry.details && (
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-5 w-5">
                                            <Info className="h-3 w-3" />
                                            <span className="sr-only">Details</span>
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Action Details</DialogTitle>
                                        </DialogHeader>
                                        <HistoryDetailsViewer details={entry.details} />
                                    </DialogContent>
                                </Dialog>
                            )}
                            <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                                {safeFormat(entry.timestamp, 'p')}
                            </span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                         <span className="text-xs text-muted-foreground">{entry.userName || 'Unknown'}</span>
                         <span className="text-xs text-muted-foreground">
                            {safeFormat(entry.timestamp, 'MMM d')}
                         </span>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
}
