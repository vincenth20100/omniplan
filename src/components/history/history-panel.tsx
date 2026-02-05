'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { HistoryEntry, Snapshot, PersistentHistoryEntry } from "@/lib/types";
import { HistoryList } from "./history-list";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Eye, RotateCcw } from "lucide-react";
import { useState } from "react";

const safeFormat = (val: any, fmt: string) => {
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

function PersistentLogList({ history }: { history: PersistentHistoryEntry[] }) {
  if (history.length === 0) {
      return <div className="text-center text-sm text-muted-foreground p-8">No history recorded.</div>;
  }

  const getActionDescription = (entry: PersistentHistoryEntry): string => {
    const type = entry.actionType.replace(/_/g, ' ').toLowerCase();
    return `${type} ${entry.payloadDescription || ''}`.trim();
  }

  return (
    <ScrollArea className="h-full mt-4">
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
    </ScrollArea>
  );
}

interface HistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: HistoryEntry[];
  currentIndex: number;
  dispatch: any;
  persistentHistory: PersistentHistoryEntry[];
  snapshots: Snapshot[];
  onSaveSnapshot: (name: string) => void;
  onRestoreSnapshot: (snapshot: Snapshot) => void;
  onDeleteSnapshot: (id: string) => void;
  onPreviewSnapshot: (snapshot: Snapshot) => void;
}

export function HistoryPanel({
  open,
  onOpenChange,
  history,
  currentIndex,
  dispatch,
  persistentHistory,
  snapshots,
  onSaveSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onPreviewSnapshot,
}: HistoryPanelProps) {
  const [newSnapshotName, setNewSnapshotName] = useState('');

  const handleCreateSnapshot = () => {
      if (newSnapshotName.trim()) {
          onSaveSnapshot(newSnapshotName.trim());
          setNewSnapshotName('');
      }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Project History</SheetTitle>
          <SheetDescription>
            View history, undo changes, or manage snapshots.
          </SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="session" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="session">Session</TabsTrigger>
                <TabsTrigger value="log">Log</TabsTrigger>
                <TabsTrigger value="snapshots">Snapshots</TabsTrigger>
            </TabsList>
            <TabsContent value="session" className="h-[calc(100vh-12rem)]">
                 <HistoryList history={history} currentIndex={currentIndex} dispatch={dispatch} />
            </TabsContent>
            <TabsContent value="log" className="h-[calc(100vh-12rem)]">
                 <PersistentLogList history={persistentHistory} />
            </TabsContent>
            <TabsContent value="snapshots" className="h-[calc(100vh-12rem)] flex flex-col">
                 <div className="flex gap-2 p-1">
                     <Input
                        placeholder="Snapshot Name"
                        value={newSnapshotName}
                        onChange={(e) => setNewSnapshotName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateSnapshot()}
                     />
                     <Button onClick={handleCreateSnapshot} disabled={!newSnapshotName.trim()}>
                        <Plus className="h-4 w-4 mr-2"/> Save
                     </Button>
                 </div>
                 <Separator className="my-2" />
                 <ScrollArea className="flex-1">
                     <div className="flex flex-col gap-2 pr-4 pb-4">
                        {snapshots.map(snap => (
                            <div key={snap.id} className="flex flex-col border rounded-md p-3">
                                <div className="flex justify-between items-start">
                                    <span className="font-medium text-sm">{snap.name}</span>
                                    <span className="text-xs text-muted-foreground">{snap.createdAt ? safeFormat(snap.createdAt, 'PP p') : ''}</span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 mb-3">
                                    {/* Created by would be ideally a name not UID, but UID is stored. */}
                                    {/* Ideally fetch user profile or store displayName in snapshot. */}
                                    {/* For now, just omit user if we only have UID, or show UID for debug */}
                                    Created on {safeFormat(snap.createdAt, 'PP')}
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button size="sm" variant="outline" onClick={() => onPreviewSnapshot(snap)} title="Preview">
                                        <Eye className="h-3 w-3 mr-1" /> Preview
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => onRestoreSnapshot(snap)} title="Restore">
                                        <RotateCcw className="h-3 w-3 mr-1" /> Restore
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => onDeleteSnapshot(snap.id)} title="Delete">
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                        {snapshots.length === 0 && (
                            <div className="text-center text-sm text-muted-foreground p-8">No snapshots saved.</div>
                        )}
                     </div>
                 </ScrollArea>
            </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
