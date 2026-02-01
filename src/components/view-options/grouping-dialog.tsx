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
import type { ColumnSpec, View } from "@/lib/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { GroupingPanel } from "./grouping-panel";

export function GroupingDialog({
    open,
    onOpenChange,
    grouping,
    columns,
    dispatch,
    views,
    currentViewId,
    isDirty,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    grouping: string[];
    columns: ColumnSpec[];
    dispatch: any;
    views: View[];
    currentViewId: string | null;
    isDirty?: boolean;
}) {
    const isMobile = useIsMobile();
    
    const handleApply = (newGrouping: string[]) => {
        dispatch({ type: 'SET_GROUPING', payload: newGrouping });
        onOpenChange(false);
    };

    const handleCancel = () => {
        onOpenChange(false);
    };

    if (isMobile) {
        return (
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent side="left" className="flex flex-col w-full sm:max-w-md">
                    <SheetHeader>
                        <SheetTitle>Group By</SheetTitle>
                    </SheetHeader>
                    <GroupingPanel
                        grouping={grouping}
                        columns={columns}
                        dispatch={dispatch}
                        views={views}
                        currentViewId={currentViewId}
                        isDirty={isDirty}
                        onApply={handleApply}
                        onCancel={handleCancel}
                    />
                </SheetContent>
            </Sheet>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex flex-col overflow-hidden sm:max-w-3xl max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Group By</DialogTitle>
                </DialogHeader>
                <GroupingPanel
                    grouping={grouping}
                    columns={columns}
                    dispatch={dispatch}
                    views={views}
                    currentViewId={currentViewId}
                    isDirty={isDirty}
                    onApply={handleApply}
                    onCancel={handleCancel}
                />
            </DialogContent>
        </Dialog>
    );
}
