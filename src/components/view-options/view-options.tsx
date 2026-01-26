'use client';

import { Button } from "@/components/ui/button";
import { Layers, Filter } from "lucide-react";
import { ColumnSelector } from '@/components/layout/column-selector';
import type { ColumnSpec, UiDensity } from "@/lib/types";
import { Separator } from "../ui/separator";
import { DensitySelector } from "./density-selector";

export function ViewOptions({
    visibleColumns,
    columns,
    dispatch,
    uiDensity,
}: {
    visibleColumns: string[];
    columns: ColumnSpec[];
    dispatch: any;
    uiDensity: UiDensity;
}) {
    return (
        <div className="p-2">
            <h3 className="text-sm font-semibold mb-2 px-2 text-muted-foreground">VIEW</h3>
            <div className="flex flex-col gap-2">
                <ColumnSelector visibleColumns={visibleColumns} columns={columns} dispatch={dispatch} />
                <Button variant="ghost" className="w-full justify-start gap-2" disabled>
                    <Filter className="h-4 w-4" />
                    Filter
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2" disabled>
                    <Layers className="h-4 w-4" />
                    Group
                </Button>
                <Separator className="my-1" />
                <DensitySelector density={uiDensity} dispatch={dispatch} />
            </div>
        </div>
    );
}
