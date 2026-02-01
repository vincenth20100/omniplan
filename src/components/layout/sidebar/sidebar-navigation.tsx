'use client';

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
    Plus,
    Trash2,
    Undo2,
    Redo2,
    Layers
} from 'lucide-react';
import {
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarGroupContent,
    SidebarSeparator
} from "@/components/ui/sidebar";
import type { SidebarView } from "./mobile-sidebar-container";
import type { ProjectState } from "@/lib/types";

export function SidebarNavigation({
    onNavigate,
    dispatch,
    canUndo,
    canRedo,
    canRemove,
    isEditor,
}: {
    onNavigate: (view: SidebarView) => void;
    dispatch: any;
    canUndo: boolean;
    canRedo: boolean;
    canRemove: boolean;
    isEditor: boolean;
}) {

    return (
        <div className="flex flex-col gap-0">
             <SidebarGroup>
                <SidebarGroupLabel>Edit</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                onClick={() => dispatch({ type: 'ADD_TASK', payload: { id: crypto.randomUUID() } })}
                                disabled={!isEditor}
                                tooltip="Add Task"
                            >
                                <Plus />
                                <span>Add Task</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        {/* Insert Project triggers a dialog, handled via state in ProjectPage.
                            If we want it here, we might need a way to trigger that dialog.
                            For now, let's omit or assume we can trigger it differently.
                            The user asked for "New files" which usually means Add Task in this context.
                            Let's skip Insert Project if we can't trigger the dialog easily from here without more props.
                        */}
                         <SidebarMenuItem>
                            <SidebarMenuButton
                                onClick={() => dispatch({ type: 'UNDO' })}
                                disabled={!canUndo || !isEditor}
                                tooltip="Undo"
                            >
                                <Undo2 />
                                <span>Undo</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                         <SidebarMenuItem>
                            <SidebarMenuButton
                                onClick={() => dispatch({ type: 'REDO' })}
                                disabled={!canRedo || !isEditor}
                                tooltip="Redo"
                            >
                                <Redo2 />
                                <span>Redo</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                         <SidebarMenuItem>
                            <SidebarMenuButton
                                onClick={() => dispatch({ type: 'REMOVE_TASK' })}
                                disabled={!canRemove || !isEditor}
                                tooltip="Delete"
                            >
                                <Trash2 />
                                <span>Delete</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />

            <SidebarGroup>
                <SidebarGroupLabel>Data</SidebarGroupLabel>
                 <SidebarGroupContent>
                    <SidebarMenu>
                         <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => onNavigate('resources')} disabled={!isEditor} tooltip="Resources">
                                <Users />
                                <span>Resources</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                         <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => onNavigate('calendars')} disabled={!isEditor} tooltip="Calendars">
                                <CalendarDays />
                                <span>Calendars</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />

            <SidebarGroup>
                <SidebarGroupLabel>View</SidebarGroupLabel>
                 <SidebarGroupContent>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => onNavigate('filters')} tooltip="Filters">
                                <Filter />
                                <span>Filters</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => onNavigate('grouping')} tooltip="Grouping">
                                <FolderTree />
                                <span>Grouping</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => onNavigate('gantt-settings')} tooltip="Display Options">
                                <Settings />
                                <span>Display Options</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />

            <SidebarGroup>
                <SidebarGroupLabel>Tools</SidebarGroupLabel>
                 <SidebarGroupContent>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => onNavigate('history')} tooltip="History">
                                <History />
                                <span>History</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => onNavigate('shortcuts')} tooltip="Shortcuts">
                                <Keyboard />
                                <span>Shortcuts</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => onNavigate('find-replace')} disabled={!isEditor} tooltip="Find & Replace">
                                <Search />
                                <span>Find & Replace</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => onNavigate('print')} tooltip="Print Preview">
                                <Printer />
                                <span>Print Preview</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
        </div>
    );
}
