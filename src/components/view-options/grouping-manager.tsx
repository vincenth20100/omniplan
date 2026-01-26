'use client';

import { Button } from "@/components/ui/button";
import { Layers } from "lucide-react";

export function GroupingManager({ grouping, onOpenGroupingDialog }: { grouping: string[], onOpenGroupingDialog: () => void }) {
    const groupCount = grouping.length;
    return (
        <Button variant={groupCount > 0 ? "secondary" : "ghost"} className="w-full justify-start gap-2" onClick={onOpenGroupingDialog}>
            <Layers className="h-4 w-4" />
            Group
            {groupCount > 0 && (
                 <span className="ml-auto text-xs font-semibold bg-muted text-muted-foreground rounded-full px-2">
                    {groupCount}
                </span>
            )}
        </Button>
    );
}
