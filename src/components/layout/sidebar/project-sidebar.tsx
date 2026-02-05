'use client';

import React, { useEffect } from 'react';
import { SidebarNavigation } from "./sidebar-navigation";
import { FilterPanel } from "@/components/view-options/filter-panel";
import { GroupingPanel } from "@/components/view-options/grouping-panel";
import { ColumnPanel } from "@/components/view-options/column-panel";
import { ViewManager } from "@/components/view-options/view-manager";
import { ResourceView } from "@/components/resources/resource-view";
import { CalendarView } from "@/components/calendars/calendar-view";
import { GanttSettingsContent } from "@/components/gantt-settings/gantt-settings-content";
import { HistoryList } from "@/components/history/history-list";
import { SubprojectManagerContent } from "@/components/subproject-manager-content";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { ProjectState, HistoryEntry } from "@/lib/types";
import { Separator } from "@/components/ui/separator";
import { useSidebar, SidebarTrigger } from "@/components/ui/sidebar";
import type { User } from 'firebase/auth';

export type SidebarView = 'main' | 'resources' | 'calendars' | 'filters' | 'grouping' | 'gantt-settings' | 'history' | 'shortcuts' | 'find-replace' | 'print' | 'columns' | 'manage-views' | 'subprojects';

export function ProjectSidebar({
    view,
    onNavigate,
    projectState,
    dispatch,
    defaultContent,
    history,
    historyIndex,
    onManageThemes,
    isEditor,
    canUndo,
    canRedo,
    canRemove,
    canIndent,
    canOutdent,
    onSetBaseline,
    onManageBaselines,
    user,
    currentProjectId,
    existingSubprojectIds,
}: {
    view: SidebarView;
    onNavigate: (view: SidebarView) => void;
    projectState: ProjectState;
    dispatch: any;
    defaultContent: React.ReactNode;
    history: HistoryEntry[];
    historyIndex: number;
    onManageThemes: () => void;
    isEditor: boolean;
    canUndo: boolean;
    canRedo: boolean;
    canRemove: boolean;
    canIndent?: boolean;
    canOutdent?: boolean;
    onSetBaseline?: () => void;
    onManageBaselines?: () => void;
    user: User;
    currentProjectId: string;
    existingSubprojectIds?: string[];
}) {
    const { state, setOpenMobile, setOpen, isMobile } = useSidebar();

    // Automatically expand the sidebar when entering a sub-view (panel)
    // ensuring the content is visible.
    useEffect(() => {
        if (view !== 'main') {
            if (isMobile) {
                setOpenMobile(true);
            } else {
                setOpen(true);
            }
        }
    }, [view, isMobile, setOpenMobile, setOpen]);

    const handleBack = () => {
        onNavigate('main');
    };

    if (view === 'main') {
        return (
            <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-2">
                     <span className="text-sm font-semibold text-muted-foreground group-data-[collapsible=icon]:hidden">
                        Project Tools
                     </span>
                     <SidebarTrigger />
                </div>

                <SidebarNavigation
                    onNavigate={onNavigate}
                    dispatch={dispatch}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    canRemove={canRemove}
                    canIndent={canIndent}
                    canOutdent={canOutdent}
                    isEditor={isEditor}
                />

                {state === 'expanded' && (
                    <>
                        <Separator className="my-2" />
                        <div className="flex-1 overflow-auto">
                            {defaultContent}
                        </div>
                    </>
                )}
            </div>
        );
    }

    let content = null;
    let title = '';

    switch (view) {
        case 'resources':
            title = 'Resources';
            content = <ResourceView projectState={projectState} dispatch={dispatch} />;
            break;
        case 'calendars':
            title = 'Calendars';
            content = <CalendarView projectState={projectState} dispatch={dispatch} />;
            break;
        case 'columns':
            title = 'Columns';
            content = (
                <ColumnPanel
                    visibleColumns={projectState.visibleColumns}
                    columns={projectState.columns}
                    dispatch={dispatch}
                    onCancel={handleBack}
                />
            );
            break;
        case 'subprojects':
            title = 'Manage Subprojects';
            content = (
                <SubprojectManagerContent
                    user={user}
                    currentProjectId={currentProjectId}
                    existingSubprojectIds={existingSubprojectIds}
                    onClose={handleBack}
                />
            );
            break;
        case 'filters':
            title = 'Filters';
            content = (
                <FilterPanel
                    filters={projectState.filters}
                    columns={projectState.columns}
                    dispatch={dispatch}
                    views={projectState.views}
                    currentViewId={projectState.currentViewId}
                    isDirty={projectState.isDirty}
                    onApply={(filters) => {
                        dispatch({ type: 'SET_FILTERS', payload: filters });
                        handleBack();
                    }}
                    onCancel={handleBack}
                />
            );
            break;
        case 'manage-views':
            title = 'Manage Views';
            content = (
                <ViewManager
                    views={projectState.views}
                    currentViewId={projectState.currentViewId}
                    isDirty={projectState.isDirty}
                    dispatch={dispatch}
                    isEditor={isEditor}
                />
            );
            break;
        case 'grouping':
            title = 'Grouping';
            content = (
                <GroupingPanel
                    grouping={projectState.grouping}
                    columns={projectState.columns}
                    dispatch={dispatch}
                    views={projectState.views}
                    currentViewId={projectState.currentViewId}
                    isDirty={projectState.isDirty}
                    onApply={(grouping) => {
                        dispatch({ type: 'SET_GROUPING', payload: grouping });
                        handleBack();
                    }}
                    onCancel={handleBack}
                />
            );
            break;
        case 'gantt-settings':
            title = 'Display Options';
            content = (
                <GanttSettingsContent
                    settings={projectState.ganttSettings}
                    stylePresets={projectState.stylePresets}
                    activeStylePresetId={projectState.activeStylePresetId}
                    baselines={projectState.baselines}
                    dispatch={dispatch}
                    onManageThemes={onManageThemes}
                    isEditor={isEditor}
                    onSetBaseline={onSetBaseline}
                    onManageBaselines={onManageBaselines}
                />
            );
            break;
        case 'history':
            title = 'History';
            content = (
                <HistoryList
                    history={history}
                    currentIndex={historyIndex}
                    dispatch={dispatch}
                />
            );
            break;
        case 'shortcuts':
             title = 'Shortcuts';
             content = <div>Shortcuts Content Placeholder</div>;
             break;
        case 'find-replace':
             title = 'Find & Replace';
             content = <div>Find & Replace Content Placeholder</div>;
             break;
        case 'print':
             // Print might need special handling as it usually opens a dialog/window
             title = 'Print Preview';
             content = <div>Print Preview is not supported in sidebar yet.</div>;
             break;
        default:
            content = <div>Content for {view}</div>;
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-2 py-2 border-b">
                <Button variant="ghost" size="icon" onClick={handleBack}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <h3 className="font-semibold">{title}</h3>
            </div>
            <div className="flex-1 overflow-hidden p-2">
                {content}
            </div>
        </div>
    );
}
