'use client';

import React, { useEffect } from 'react';
import { DynamicSidebarNavigation } from "./dynamic-sidebar-navigation";
import { SidebarPanelContent, getSidebarTitle } from "./sidebar-panel-content";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { ProjectState, HistoryEntry } from "@/lib/types";
import { Separator } from "@/components/ui/separator";
import { useSidebar, SidebarTrigger } from "@/components/ui/sidebar";
import type { User } from 'firebase/auth';
import { useThemeContext } from '@/components/theme/theme-context';

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
    onDelete,
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
    onDelete?: () => void;
}) {
    const { state, setOpenMobile, setOpen, isMobile } = useSidebar();
    const { layoutConfig } = useThemeContext();
    const { sidebarPosition } = layoutConfig;
    const isHorizontal = sidebarPosition === 'top' || sidebarPosition === 'bottom';

    useEffect(() => {
        if (view !== 'main' && !isHorizontal) {
            if (isMobile) {
                setOpenMobile(true);
            } else {
                setOpen(true);
            }
        }
    }, [view, isMobile, setOpenMobile, setOpen, isHorizontal]);

    const handleBack = () => {
        onNavigate('main');
    };

    // If horizontal, or main view, render navigation
    if (view === 'main' || isHorizontal) {
        return (
            <div className={`flex ${isHorizontal ? 'flex-row items-center w-full overflow-hidden' : 'flex-col h-full'}`}>
                {!isHorizontal && (
                    <div className="flex items-center justify-between p-2">
                         <span className="text-sm font-semibold text-muted-foreground group-data-[collapsible=icon]:hidden">
                            Project Tools
                         </span>
                         <SidebarTrigger />
                    </div>
                )}

                <DynamicSidebarNavigation
                    onNavigate={onNavigate}
                    dispatch={dispatch}
                    currentView={view}
                />

                {!isHorizontal && state === 'expanded' && defaultContent && (
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

    const title = getSidebarTitle(view);
    const content = (
        <SidebarPanelContent
            view={view}
            projectState={projectState}
            dispatch={dispatch}
            user={user}
            currentProjectId={currentProjectId}
            existingSubprojectIds={existingSubprojectIds}
            onNavigate={onNavigate}
            onManageThemes={onManageThemes}
            history={history}
            historyIndex={historyIndex}
            onSetBaseline={onSetBaseline}
            onManageBaselines={onManageBaselines}
            isEditor={isEditor}
        />
    );

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
