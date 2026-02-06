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
import type { View } from "@/lib/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { ViewManager } from "./view-manager";
import { Button } from "@/components/ui/button";

export function ViewManagerDialog({
    open,
    onOpenChange,
    views,
    currentViewId,
    isDirty,
    dispatch,
    isEditor,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    views: View[];
    currentViewId: string | null;
    isDirty?: boolean;
    dispatch: any;
    isEditor?: boolean;
}) {
    const isMobile = useIsMobile();

    if (isMobile) {
        return (
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent side="left" className="flex flex-col w-full sm:max-w-md">
                    <SheetHeader>
                        <SheetTitle>Manage Views</SheetTitle>
                    </SheetHeader>
                    <div className="flex-1 overflow-auto py-4">
                        <ViewManager
                            views={views}
                            currentViewId={currentViewId}
                            isDirty={isDirty}
                            dispatch={dispatch}
                            isEditor={isEditor}
                            showTitle={false}
                        />
                    </div>
                     <div className="mt-auto pt-2">
                        <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>Close</Button>
                    </div>
                </SheetContent>
            </Sheet>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Manage Views</DialogTitle>
                </DialogHeader>
                 <div className="py-2">
                    <ViewManager
                        views={views}
                        currentViewId={currentViewId}
                        isDirty={isDirty}
                        dispatch={dispatch}
                        isEditor={isEditor}
                        showTitle={false}
                    />
                </div>
                 <div className="flex justify-end mt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
