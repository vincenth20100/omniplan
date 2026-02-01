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
import type { ColumnSpec, Filter as FilterType, View } from "@/lib/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { FilterPanel } from "./filter-panel";

export function FilterDialog({
    open,
    onOpenChange,
    filters,
    columns,
    dispatch,
    views,
    currentViewId,
    isDirty,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    filters: FilterType[];
    columns: ColumnSpec[];
    dispatch: any;
    views: View[];
    currentViewId: string | null;
    isDirty?: boolean;
}) {
    const isMobile = useIsMobile();
    
    const handleApply = (newFilters: FilterType[]) => {
        dispatch({ type: 'SET_FILTERS', payload: newFilters });
        onOpenChange(false);
    };
    
    const handleCancel = () => {
        onOpenChange(false);
    }

    if (isMobile) {
        return (
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent side="left" className="flex flex-col w-full sm:max-w-md">
                    <SheetHeader>
                        <SheetTitle>Filter Tasks</SheetTitle>
                    </SheetHeader>
                    <FilterPanel
                         filters={filters}
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
                    <DialogTitle>Filter Tasks</DialogTitle>
                </DialogHeader>
                 <FilterPanel
                     filters={filters}
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
