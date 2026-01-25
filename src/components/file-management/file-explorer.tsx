'use client';

import { Button } from "@/components/ui/button";
import { FilePlus, FolderOpen, Save } from "lucide-react";

export function FileExplorer() {
    return (
        <div className="p-2">
            <h3 className="text-sm font-semibold mb-2 px-2 text-muted-foreground">FILE</h3>
            <div className="flex flex-col gap-1">
                <Button variant="ghost" className="w-full justify-start gap-2" disabled>
                    <FilePlus className="h-4 w-4" />
                    New
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2" disabled>
                    <FolderOpen className="h-4 w-4" />
                    Load
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2" disabled>
                    <Save className="h-4 w-4" />
                    Save
                </Button>
            </div>
        </div>
    );
}
