'use client';

import { Users } from "lucide-react";
import type { ProjectState } from "@/lib/types";

export function ResourceView({ projectState }: { projectState: ProjectState }) {
    return (
        <div className="p-2">
            <h3 className="text-sm font-semibold mb-2 px-2 text-muted-foreground">RESOURCES</h3>
            <div className="p-4 border rounded-lg bg-muted/20 text-center">
                 <Users className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                    Resource management coming soon.
                </p>
            </div>
        </div>
    );
}
