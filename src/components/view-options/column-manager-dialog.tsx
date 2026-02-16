'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ColumnSpec } from "@/lib/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { ColumnPanel } from "./column-panel";

export function ColumnManagerDialog({
    open,
    onOpenChange,
    visibleColumns,
    columns,
    dispatch,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    visibleColumns: string[];
    columns: ColumnSpec[];
    dispatch: any;
}) {
    const isMobile = useIsMobile();

    const handleCancel = () => {
        onOpenChange(false);
    };

    if (isMobile) {
        return (
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent side="left" className="flex flex-col w-full sm:max-w-md">
                    <SheetHeader>
                        <SheetTitle>Manage Columns</SheetTitle>
                    </SheetHeader>
                    <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                        <ColumnPanel
                            visibleColumns={visibleColumns}
                            columns={columns}
                            dispatch={dispatch}
                            onCancel={handleCancel}
                        />
                    </div>
                </SheetContent>
            </Sheet>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex flex-col overflow-hidden sm:max-w-lg max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle>Manage Columns</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-hidden p-1 min-h-0 flex flex-col">
                    <ColumnPanel
                        visibleColumns={visibleColumns}
                        columns={columns}
                        dispatch={dispatch}
                        onCancel={handleCancel}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
