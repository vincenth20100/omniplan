'use client';

import type { ProjectState } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Map } from "lucide-react";

export function SpatialView({ projectState }: { projectState: ProjectState }) {
    return (
        <div className="p-2">
            <h3 className="text-sm font-semibold mb-2 px-2 text-muted-foreground">SPATIAL VIEW</h3>
            <div className="p-4 border rounded-lg bg-muted/20 text-center">
                 <Map className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                    4D Map view is in development.
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">Requires Google Maps API Key.</p>
            </div>
        </div>
    );
}
