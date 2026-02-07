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
    Layers,
    Columns3,
    Indent,
    Outdent,
    ChevronsUp,
    ChevronsDown
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
import type { SidebarView } from "./project-sidebar";
import type { ProjectState } from "@/lib/types";

export function SidebarNavigation({
    onNavigate,
    dispatch,
    canUndo,
    canRedo,
    canRemove,
    canIndent,
    canOutdent,
    isEditor,
    onDelete,
}: {
    onNavigate: (view: SidebarView) => void;
    dispatch: any;
    canUndo: boolean;
    canRedo: boolean;
    canRemove: boolean;
    canIndent?: boolean;
    canOutdent?: boolean;
    isEditor: boolean;
    onDelete?: () => void;
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
                                onClick={() => {
                                    if (onDelete) {
                                        onDelete();
                                    } else {
                                        dispatch({ type: 'REMOVE_TASK' });
                                    }
                                }}
                                disabled={!canRemove || !isEditor}
                                tooltip="Delete"
                            >
                                <Trash2 />
                                <span>Delete</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                onClick={() => dispatch({ type: 'INDENT_TASK' })}
                                disabled={!canIndent || !isEditor}
                                tooltip="Indent Task"
                            >
                                <Indent />
                                <span>Indent</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                onClick={() => dispatch({ type: 'OUTDENT_TASK' })}
                                disabled={!canOutdent || !isEditor}
                                tooltip="Outdent Task"
                            >
                                <Outdent />
                                <span>Outdent</span>
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
                         <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => onNavigate('subprojects' as SidebarView)} disabled={!isEditor} tooltip="Manage Subprojects">
                                <FolderTree />
                                <span>Subprojects</span>
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
                            <SidebarMenuButton onClick={() => onNavigate('columns')} tooltip="Columns">
                                <Columns3 />
                                <span>Columns</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
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
                            <SidebarMenuButton onClick={() => dispatch({ type: 'COLLAPSE_ALL' })} tooltip="Collapse All">
                                <ChevronsUp />
                                <span>Collapse All</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                         <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => dispatch({ type: 'EXPAND_ALL' })} tooltip="Expand All">
                                <ChevronsDown />
                                <span>Expand All</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => onNavigate('gantt-settings')} tooltip="Display Options">
                                <Settings />
                                <span>Display Options</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => onNavigate('manage-views')} tooltip="Manage Views">
                                <Layers />
                                <span>Manage Views</span>
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
