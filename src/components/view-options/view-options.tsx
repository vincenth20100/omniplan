'use client';

import { Button } from "@/components/ui/button";
import { Layers, Filter } from "lucide-react";
import { ColumnSelector } from '@/components/layout/column-selector';
import type { ProjectState } from "@/lib/types";

export function ViewOptions({
    visibleColumns,
    dispatch,
}: {
    visibleColumns: string[];
    dispatch: any;
}) {
    return (
        <div className="p-2">
            <h3 className="text-sm font-semibold mb-2 px-2 text-muted-foreground">VIEW</h3>
            <div className="flex flex-col gap-1">
                <ColumnSelector visibleColumns={visibleColumns} dispatch={dispatch} />
                <Button variant="ghost" className="w-full justify-start gap-2" disabled>
                    <Filter className="h-4 w-4" />
                    Filter
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2" disabled>
                    <Layers className="h-4 w-4" />
                    Group
                </Button>
            </div>
        </div>
    );
}
