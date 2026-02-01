'use client';

import { Button } from "@/components/ui/button";
import {
    Users,
    CalendarDays,
    Filter,
    FolderTree,
    Settings,
    History,
    Keyboard,
    Search,
    Printer,
    Layers
} from 'lucide-react';
import type { SidebarView } from "./mobile-sidebar-container";

export function SidebarNavigation({
    onNavigate,
}: {
    onNavigate: (view: SidebarView) => void;
}) {
    const items = [
        { id: 'resources', label: 'Resources', icon: Users },
        { id: 'calendars', label: 'Calendars', icon: CalendarDays },
        { id: 'filters', label: 'Filters', icon: Filter },
        { id: 'grouping', label: 'Grouping', icon: FolderTree }, // Fallback handled by icon existence? Assuming FolderTree works as it's imported in project-page
        { id: 'gantt-settings', label: 'Display Options', icon: Settings },
        { id: 'history', label: 'History', icon: History },
        { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
        { id: 'find-replace', label: 'Find & Replace', icon: Search },
        { id: 'print', label: 'Print Preview', icon: Printer },
         // Project Settings and Baselines are complex, maybe keep them as dialogs for now or add later
    ] as const;

    return (
        <div className="grid grid-cols-2 gap-2 p-2">
            {items.map((item) => (
                <Button
                    key={item.id}
                    variant="outline"
                    className="flex flex-col items-center justify-center h-20 gap-2"
                    onClick={() => onNavigate(item.id as SidebarView)}
                >
                    <item.icon className="h-6 w-6" />
                    <span className="text-xs">{item.label}</span>
                </Button>
            ))}
        </div>
    );
}
