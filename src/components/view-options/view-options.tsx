'use client';

import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import { ColumnSelector } from '@/components/layout/column-selector';
import type { ColumnSpec, UiDensity } from "@/lib/types";
import { Separator } from "../ui/separator";
import { DensitySelector } from "./density-selector";
import { GroupingManager } from "./grouping-manager";

export function ViewOptions({
    visibleColumns,
    columns,
    dispatch,
    uiDensity,
    grouping,
    onOpenGroupingDialog,
}: {
    visibleColumns: string[];
    columns: ColumnSpec[];
    dispatch: any;
    uiDensity: UiDensity;
    grouping: string[];
    onOpenGroupingDialog: () => void;
}) {
    return (
        <div className="p-2">
            <h3 className="text-sm font-semibold mb-2 px-2 text-muted-foreground">VIEW</h3>
            <div className="flex flex-col gap-1">
                <ColumnSelector visibleColumns={visibleColumns} columns={columns} dispatch={dispatch} />
                <Button variant="ghost" className="w-full justify-start gap-2" disabled>
                    <Filter className="h-4 w-4" />
                    Filter
                </Button>
                <GroupingManager onOpenGroupingDialog={onOpenGroupingDialog} />
                <Separator className="my-1" />
                <DensitySelector density={uiDensity} dispatch={dispatch} />
            </div>
        </div>
    );
}
