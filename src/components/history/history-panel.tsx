'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { HistoryEntry } from "@/lib/types";
import { HistoryList } from "./history-list";

export function HistoryPanel({
  open,
  onOpenChange,
  history,
  currentIndex,
  dispatch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: HistoryEntry[];
  currentIndex: number;
  dispatch: any;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Action History</SheetTitle>
          <SheetDescription>
            A log of all your changes in this session. Click an entry to jump back to that state.
          </SheetDescription>
        </SheetHeader>
        <div className="h-[calc(100vh-8rem)]">
            <HistoryList
                history={history}
                currentIndex={currentIndex}
                dispatch={dispatch}
            />
        </div>
      </SheetContent>
    </Sheet>
  );
}
