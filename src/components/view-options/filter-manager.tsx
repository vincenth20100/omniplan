'use client';

import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import type { Filter as FilterType } from '@/lib/types';

export function FilterManager({ filters, onOpenFilterDialog }: { filters: FilterType[], onOpenFilterDialog: () => void }) {
    const filterCount = filters.length;
    return (
        <Button variant="ghost" className="w-full justify-start gap-2" onClick={onOpenFilterDialog}>
            <Filter className="h-4 w-4" />
            Filter
            {filterCount > 0 && (
                 <span className="ml-auto text-xs font-semibold bg-muted text-muted-foreground rounded-full px-2">
                    {filterCount}
                </span>
            )}
        </Button>
    );
}
