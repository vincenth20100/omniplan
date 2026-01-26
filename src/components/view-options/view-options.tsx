'use client';

import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import { ColumnSelector } from '@/components/layout/column-selector';
import type { ColumnSpec, UiDensity, View } from "@/lib/types";
import { Separator } from "../ui/separator";
import { DensitySelector } from "./density-selector";
import { GroupingManager } from "./grouping-manager";
import { ViewManager } from "./view-manager";

export function ViewOptions({
    visibleColumns,
    columns,
    dispatch,
    uiDensity,
    grouping,
    onOpenGroupingDialog,
    views,
    currentViewId,
}: {
    visibleColumns: string[];
    columns: ColumnSpec[];
    dispatch: any;
    uiDensity: UiDensity;
    grouping: string[];
    onOpenGroupingDialog: () => void;
    views: View[];
    currentViewId: string | null;
}) {
    return (
        <div className="p-2">
            <ViewManager views={views} currentViewId={currentViewId} dispatch={dispatch} />
            <Separator className="my-2" />
            <h3 className="text-sm font-semibold mb-2 px-2 text-muted-foreground">DISPLAY OPTIONS</h3>
            <div className="flex flex-col gap-1">
                <ColumnSelector visibleColumns={visibleColumns} columns={columns} dispatch={dispatch} />
                <Button variant="ghost" className="w-full justify-start gap-2" disabled>
                    <Filter className="h-4 w-4" />
                    Filter
                </Button>
                <GroupingManager onOpenGroupingDialog={onOpenGroupingDialog} />
            </div>
            <Separator className="my-2" />
            <DensitySelector density={uiDensity} dispatch={dispatch} />
        </div>
    );
}
