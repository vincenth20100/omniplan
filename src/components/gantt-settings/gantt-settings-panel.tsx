'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
        <GanttSettingsContent
            settings={settings}
            stylePresets={stylePresets}
            activeStylePresetId={activeStylePresetId}
            baselines={baselines}
            dispatch={dispatch}
            onManageThemes={onManageThemes}
            isEditor={isEditor}
        />
      </SheetContent>
    </Sheet>
  );
}
