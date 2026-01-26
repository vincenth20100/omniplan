'use client';

import { Button } from "@/components/ui/button";
import { ColumnSelector } from '@/components/layout/column-selector';
import type { ColumnSpec, UiDensity, View, Filter } from "@/lib/types";
import { Separator } from "../ui/separator";
import { DensitySelector } from "./density-selector";
import { GroupingManager } from "./grouping-manager";
import { FilterManager } from "./filter-manager";
import { ViewManager } from "./view-manager";

export function ViewOptions({
    visibleColumns,
    columns,
    dispatch,
    uiDensity,
    grouping,
    filters,
    onOpenGroupingDialog,
    onOpenFilterDialog,
    views,
    currentViewId,
    isDirty,
}: {
    visibleColumns: string[];
    columns: ColumnSpec[];
    dispatch: any;
    uiDensity: UiDensity;
    grouping: string[];
    filters: Filter[];
    onOpenGroupingDialog: () => void;
    onOpenFilterDialog: () => void;
    views: View[];
    currentViewId: string | null;
    isDirty?: boolean;
}) {
    return (
        <div className="p-2">
            <ViewManager views={views} currentViewId={currentViewId} isDirty={isDirty} dispatch={dispatch} />
            <Separator className="my-2" />
            <h3 className="text-sm font-semibold mb-2 px-2 text-muted-foreground">DISPLAY OPTIONS</h3>
            <div className="flex flex-col gap-1">
                <ColumnSelector visibleColumns={visibleColumns} columns={columns} dispatch={dispatch} />
                <FilterManager filters={filters} onOpenFilterDialog={onOpenFilterDialog} />
                <GroupingManager onOpenGroupingDialog={onOpenGroupingDialog} />
            </div>
            <Separator className="my-2" />
            <DensitySelector density={uiDensity} dispatch={dispatch} />
        </div>
    );
}
