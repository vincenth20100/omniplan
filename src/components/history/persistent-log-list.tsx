import { format } from "date-fns";
import type { PersistentHistoryEntry } from "@/lib/types";
import React from "react";

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
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                            {safeFormat(entry.timestamp, 'p')}
                        </span>
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
