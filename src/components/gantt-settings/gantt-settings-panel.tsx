'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import type { GanttSettings, StylePreset, Baseline } from "@/lib/types";
import { GanttSettingsContent } from "./gantt-settings-content";

export function GanttSettingsPanel({
  open,
  onOpenChange,
  settings,
  stylePresets,
  activeStylePresetId,
  baselines,
  dispatch,
  onManageThemes,
  isEditor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: GanttSettings;
  stylePresets: StylePreset[];
  activeStylePresetId: string | null;
  baselines: Baseline[];
  dispatch: any;
  onManageThemes: () => void;
  isEditor: boolean;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="flex flex-col">
          <SheetHeader>
            <SheetTitle>Display Options</SheetTitle>
            <SheetDescription>
              Customize the appearance of the Gantt chart and grid.
            </SheetDescription>
             {!isEditor && <p className="mt-2 text-destructive font-semibold">You have view-only permissions. Your changes will not be saved.</p>}
          </SheetHeader>
          <div className="flex-1 overflow-auto">
            <GanttSettingsContent
                settings={settings}
                stylePresets={stylePresets}
                activeStylePresetId={activeStylePresetId}
                baselines={baselines}
                dispatch={dispatch}
                onManageThemes={onManageThemes}
                isEditor={isEditor}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col h-full sm:max-w-2xl sm:h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Display Options</DialogTitle>
          <DialogDescription>
            Customize the appearance of the Gantt chart and grid.
          </DialogDescription>
           {!isEditor && <p className="mt-2 text-destructive font-semibold">You have view-only permissions. Your changes will not be saved.</p>}
        </DialogHeader>
        <div className="flex-grow overflow-auto pr-2">
            <GanttSettingsContent
                settings={settings}
                stylePresets={stylePresets}
                activeStylePresetId={activeStylePresetId}
                baselines={baselines}
                dispatch={dispatch}
                onManageThemes={onManageThemes}
                isEditor={isEditor}
            />
        </div>
      </DialogContent>
    </Dialog>
  );
}
