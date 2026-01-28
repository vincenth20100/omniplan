'use client';
import { Button } from '@/components/ui/button';
import type { UiDensity } from '@/lib/types';

export function DensitySelector({
    density,
    dispatch,
    disabled,
}: {
    density: UiDensity;
    dispatch: any;
    disabled?: boolean;
}) {
    const densities: { id: UiDensity, label: string }[] = [
        { id: 'compact', label: 'Compact' },
        { id: 'medium', label: 'Medium' },
        { id: 'large', label: 'Large' },
    ];

    return (
        <div>
            <h4 className="text-xs font-semibold mb-1 px-2 text-muted-foreground">DENSITY</h4>
            <div className="p-1 flex justify-between rounded-md bg-muted">
                {densities.map((d) => (
                    <Button
                        key={d.id}
                        variant={density === d.id ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => dispatch({ type: 'SET_UI_DENSITY', payload: d.id })}
                        className="flex-1 text-xs h-7"
                        disabled={disabled}
                    >
                        {d.label}
                    </Button>
                ))}
            </div>
        </div>
    );
}
