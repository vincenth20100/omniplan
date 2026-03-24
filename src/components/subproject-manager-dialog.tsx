'use client';

import type { AppUser as User } from '@/types/auth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { SubprojectManagerContent } from '@/components/subproject-manager-content';

interface SubprojectManagerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: User;
    currentProjectId: string;
    existingSubprojectIds?: string[];
}

export function SubprojectManagerDialog({ open, onOpenChange, user, currentProjectId, existingSubprojectIds }: SubprojectManagerDialogProps) {
    const isMobile = useIsMobile();

    if (isMobile) {
        return (
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent side="left" className="flex flex-col p-0 gap-0 w-full sm:max-w-md h-full">
                     <SheetHeader className="px-6 py-4 border-b">
                        <SheetTitle>Manage Subprojects</SheetTitle>
                        <SheetDescription>Link or manage subprojects.</SheetDescription>
                    </SheetHeader>
                    <SubprojectManagerContent
                        user={user}
                        currentProjectId={currentProjectId}
                        existingSubprojectIds={existingSubprojectIds}
                        onClose={() => onOpenChange(false)}
                    />
                </SheetContent>
            </Sheet>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] sm:max-h-[80vh] flex flex-col gap-0 p-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle>Manage Subprojects</DialogTitle>
                    <DialogDescription>
                        Link external projects or manage existing connections.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 flex flex-col overflow-hidden">
                     <SubprojectManagerContent
                        user={user}
                        currentProjectId={currentProjectId}
                        existingSubprojectIds={existingSubprojectIds}
                        onClose={() => onOpenChange(false)}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
