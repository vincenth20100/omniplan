'use client';
import { Button } from "@/components/ui/button";
import { Columns3 } from "lucide-react";
import { ColumnPanel } from "@/components/view-options/column-panel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ColumnSpec } from "@/lib/types";
import { useState } from "react";

export function ColumnSelector({
    visibleColumns,
    columns,
    dispatch,
    disabled,
}: {
    visibleColumns: string[];
    columns: ColumnSpec[];
    dispatch: any;
    disabled?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon" title="Select Visible Columns" disabled={disabled}>
                    <Columns3 className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 h-[400px] p-4" align="end">
                <ColumnPanel
                    visibleColumns={visibleColumns}
                    columns={columns}
                    dispatch={dispatch}
                    onCancel={() => setIsOpen(false)}
                />
            </PopoverContent>
        </Popover>
    );
}
