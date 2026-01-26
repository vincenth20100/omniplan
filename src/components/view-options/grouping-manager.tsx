'use client';

import { Button } from "@/components/ui/button";
import { Layers } from "lucide-react";

export function GroupingManager({ onOpenGroupingDialog }: { onOpenGroupingDialog: () => void }) {
    return (
        <Button variant="ghost" className="w-full justify-start gap-2" onClick={onOpenGroupingDialog}>
            <Layers className="h-4 w-4" />
            Group
        </Button>
    );
}
