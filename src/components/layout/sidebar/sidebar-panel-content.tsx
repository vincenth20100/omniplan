'use client';

import React from 'react';
import { FilterPanel } from "@/components/view-options/filter-panel";
import { GroupingPanel } from "@/components/view-options/grouping-panel";
import { ColumnPanel } from "@/components/view-options/column-panel";
import { ViewManager } from "@/components/view-options/view-manager";
import { ResourceView } from "@/components/resources/resource-view";
import { CalendarView } from "@/components/calendars/calendar-view";
import { GanttSettingsContent } from "@/components/gantt-settings/gantt-settings-content";
import { HistoryList } from "@/components/history/history-list";
import { SubprojectManagerContent } from "@/components/subproject-manager-content";
import type { ProjectState, HistoryEntry } from "@/lib/types";
import type { AppUser as User } from '@/types/auth';
import type { SidebarView } from './project-sidebar';

export function SidebarPanelContent({
    view,
    projectState,
    dispatch,
    user,
    currentProjectId,
    existingSubprojectIds,
    onNavigate,
    onManageThemes,
    history,
    historyIndex,
    onSetBaseline,
    onManageBaselines,
    isEditor,
}: {
    view: SidebarView;
    projectState: ProjectState;
    dispatch: any;
    user: User;
    currentProjectId: string;
    existingSubprojectIds?: string[];
    onNavigate: (view: SidebarView) => void;
    onManageThemes: () => void;
    history: HistoryEntry[];
    historyIndex: number;
    onSetBaseline?: () => void;
    onManageBaselines?: () => void;
    isEditor: boolean;
}) {
    const handleBack = () => {
        onNavigate('main');
    };

    switch (view) {
        case 'resources':
            return <ResourceView projectState={projectState} dispatch={dispatch} />;
        case 'calendars':
            return <CalendarView projectState={projectState} dispatch={dispatch} />;
        case 'columns':
            return (
                <ColumnPanel
                    visibleColumns={projectState.visibleColumns}
                    columns={projectState.columns}
                    dispatch={dispatch}
                    onCancel={handleBack}
                />
            );
        case 'subprojects':
            return (
                <SubprojectManagerContent
                    user={user}
                    currentProjectId={currentProjectId}
                    existingSubprojectIds={existingSubprojectIds}
                    onClose={handleBack}
                />
            );
        case 'filters':
            return (
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
        case 'manage-views':
            return (
                <ViewManager
                    views={projectState.views}
                    currentViewId={projectState.currentViewId}
                    isDirty={projectState.isDirty}
                    dispatch={dispatch}
                    isEditor={isEditor}
                />
            );
        case 'grouping':
            return (
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
        case 'gantt-settings':
            return (
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
                    columns={projectState.columns}
                />
            );
        case 'history':
            return (
                <HistoryList
                    history={history}
                    currentIndex={historyIndex}
                    dispatch={dispatch}
                />
            );
        case 'shortcuts':
             return <div>Shortcuts Content Placeholder</div>;
        case 'find-replace':
             return <div>Find & Replace Content Placeholder</div>;
        case 'print':
             return <div>Print Preview is not supported in sidebar yet.</div>;
        default:
            return <div>Content for {view}</div>;
    }
}

export function getSidebarTitle(view: SidebarView): string {
    switch (view) {
        case 'resources': return 'Resources';
        case 'calendars': return 'Calendars';
        case 'columns': return 'Columns';
        case 'subprojects': return 'Manage Subprojects';
        case 'filters': return 'Filters';
        case 'manage-views': return 'Manage Views';
        case 'grouping': return 'Grouping';
        case 'gantt-settings': return 'Display Options';
        case 'history': return 'History';
        case 'shortcuts': return 'Shortcuts';
        case 'find-replace': return 'Find & Replace';
        case 'print': return 'Print Preview';
        default: return '';
    }
}
