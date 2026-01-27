'use client';

import type { UiDensity, View } from "@/lib/types";
import { Separator } from "../ui/separator";
import { DensitySelector } from "./density-selector";
import { ViewManager } from "./view-manager";

export function ViewOptions({
    dispatch,
    uiDensity,
    views,
    currentViewId,
    isDirty,
}: {
    dispatch: any;
    uiDensity: UiDensity;
    views: View[];
    currentViewId: string | null;
    isDirty?: boolean;
}) {
    return (
        <div className="p-2">
            <ViewManager views={views} currentViewId={currentViewId} isDirty={isDirty} dispatch={dispatch} />
            <Separator className="my-2" />
            <h3 className="text-sm font-semibold mb-2 px-2 text-muted-foreground">DISPLAY OPTIONS</h3>
            <DensitySelector density={uiDensity} dispatch={dispatch} />
        </div>
    );
}
