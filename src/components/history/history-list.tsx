'use client';

import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from 'date-fns';
import { Button } from "../ui/button";
import type { HistoryEntry } from "@/lib/types";
import { Separator } from "../ui/separator";

function getActionDescription(entry: HistoryEntry): string {
    const type = entry.actionType.replace(/_/g, ' ').toLowerCase();
    return `${type} ${entry.payloadDescription || ''}`.trim();
}

const groupHistory = (history: HistoryEntry[]) => {
    return history.reduce((acc, entry, index) => {
        const day = format(entry.timestamp, 'eeee, MMMM d, yyyy');
        if (!acc[day]) {
            acc[day] = [];
        }
        acc[day].push({ ...entry, originalIndex: index });
        return acc;
    }, {} as Record<string, (HistoryEntry & { originalIndex: number })[]>);
};

export function HistoryList({
  history,
  currentIndex,
  dispatch,
}: {
  history: HistoryEntry[];
  currentIndex: number;
  dispatch: any;
}) {
  const groupedHistory = groupHistory(history);
  const dayKeys = Object.keys(groupedHistory).reverse();

  const handleJump = (index: number) => {
    dispatch({ type: 'JUMP_TO_HISTORY', payload: { index } });
  }

  return (
    <ScrollArea className="h-full mt-4">
            {history.length > 0 ? (
                 <div className="flex flex-col-reverse gap-6 pr-4 pb-4">
                    {dayKeys.map(day => (
                        <div key={day}>
                            <div className="sticky top-0 bg-card py-2 z-10">
                                <h4 className="font-semibold text-sm">{day}</h4>
                                <Separator className="mt-2" />
                            </div>
                            <div className="flex flex-col-reverse gap-1 mt-2">
                                {groupedHistory[day].map((entry) => (
                                    <Button
                                        key={entry.timestamp.toISOString() + entry.originalIndex}
                                        variant={entry.originalIndex === currentIndex ? 'secondary' : 'ghost'}
                                        className="h-auto w-full justify-start text-left"
                                        onClick={() => handleJump(entry.originalIndex)}
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-sm capitalize font-normal">{getActionDescription(entry)}</span>
                                            <span className="text-xs text-muted-foreground">{format(entry.timestamp, 'p')}</span>
                                        </div>
                                    </Button>
                                ))}
                            </div>
                        </div>
                    ))}
                 </div>
            ) : (
                <div className="text-center text-sm text-muted-foreground p-8">
                    No actions have been recorded yet.
                </div>
            )}
    </ScrollArea>
  );
}
