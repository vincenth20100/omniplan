'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { GanttChart } from '@/components/omni-gantt/gantt-chart';
import { KanbanView } from '@/components/kanban/kanban-view';
import { TaskDetailsPanel } from '@/components/details/task-details-panel';
import { useProject } from '@/hooks/use-project';
import { FileExplorer } from '@/components/file-management/file-explorer';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ViewOptions } from '@/components/view-options/view-options';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Users, CalendarDays, Link as LinkIcon, Indent, Outdent, ListChecks, ChevronsDown, ChevronsUp, Columns3, Filter, Layers, Settings, History, Undo2, Redo2, Keyboard, Info, Search, GanttChartSquare, LayoutGrid, ZoomIn, ZoomOut, FolderTree, ArrowLeft } from 'lucide-react';
import { SpatialView } from '@/components/spatial/spatial-view';
import { ConflictDetector } from '@/components/ai/conflict-detector';
import { useState, useEffect, useMemo } from 'react';
import { ResourceManagementDialog } from '@/components/resources/resource-management-dialog';
import { CalendarManagementDialog } from '@/components/calendars/calendar-management-dialog';
import { GroupingDialog } from '@/components/view-options/grouping-dialog';
import { FilterDialog } from '@/components/view-options/filter-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { ColumnSelector } from '@/components/layout/column-selector';
import { GanttSettingsPanel } from '@/components/gantt-settings/gantt-settings-panel';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { HistoryPanel } from '@/components/history/history-panel';
import type { User } from 'firebase/auth';
import { KeyboardShortcutsDialog } from './keyboard-shortcuts-dialog';
import { FindReplaceDialog } from './find-replace-dialog';
import { useToast } from "@/hooks/use-toast";
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Representation, GanttSettings, ProjectMember, Project } from '@/lib/types';
import { PrintPreviewDialog } from './print-preview';
import { ProjectMembers } from './project-members';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { DetailedThemeEditor } from './gantt-settings/detailed-theme-editor';
import { ProjectSettingsDialog } from './project-settings-dialog';
import { ALL_COLUMNS } from '@/lib/columns';
import { SetBaselineDialog } from './set-baseline-dialog';
import { SubprojectManagerDialog } from './subproject-manager-dialog';
import { THEME_VARIABLES } from '@/lib/theme-config';
import { MobileSidebarContainer, type SidebarView } from '@/components/layout/sidebar/mobile-sidebar-container';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"


const hexToHsl = (hex: string): string => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    h = Math.round(h * 360);
    s = Math.round(s * 100);
    l = Math.round(l * 100);
    return `${h} ${s}% ${l}%`;
}


const ThemeManager = ({ theme, customStyles }: { theme: GanttSettings['theme'], customStyles: GanttSettings['customStyles'] }) => {
  useEffect(() => {
    document.documentElement.className = theme || 'dark';
  }, [theme]);

  const css = useMemo(() => {
    if (!customStyles) return '';
    
    const legacyVarMap: { [key: string]: string } = {
        ganttBarDefault: '--gantt-bar-default',
        ganttBarCritical: '--gantt-bar-critical',
        milestoneDefault: '--milestone-default',
        milestoneCritical: '--milestone-critical',
        taskRowLevel0Bg: '--task-row-level-0-bg',
        taskRowLevel1Bg: '--task-row-level-1-bg',
        taskRowLevel2PlusBg: '--task-row-level-2-plus-bg',
    };
    
    const styleEntries = Object.entries(customStyles)
      .map(([key, value]) => {
        let cssVarName = key;

        // Handle legacy keys
        if (legacyVarMap[key]) {
            cssVarName = legacyVarMap[key];
        }

        if (!cssVarName.startsWith('--')) return null;
        if (!value) return null;

        const config = THEME_VARIABLES.find(v => v.key === cssVarName);

        // If it's a legacy key or a variable requiring HSL, and value is Hex, convert it
        // Note: THEME_VARIABLES tells us if it needs HSL.
        // Legacy keys mapped to vars also need checking.
        if (config?.type === 'color-hsl' && value.startsWith('#')) {
             return `${cssVarName}: ${hexToHsl(value)};`;
        }

        return `${cssVarName}: ${value};`;
      })
      .filter(Boolean);

    if (styleEntries.length === 0) return '';
    
    return `:root { ${styleEntries.join(' ')} }`;
  }, [customStyles]);

  if (!css) return null;

  return <style>{css}</style>;
};


export function ProjectPage({ user, projectId }: { user: User, projectId: string }) {
  const router = useRouter();
  const { state, dispatch, isLoaded, isEditorOrOwner, canUndo, canRedo, history } = useProject(user, projectId);
  const [isResourceDialogOpen, setIsResourceDialogOpen] = useState(false);
  const [isCalendarDialogOpen, setIsCalendarDialogOpen] = useState(false);
  const [isGroupingDialogOpen, setIsGroupingDialogOpen] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isGanttSettingsOpen, setIsGanttSettingsOpen] = useState(false);
  const [isThemeManagerOpen, setIsThemeManagerOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = useState(false);
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [isDetailsSheetOpen, setIsDetailsSheetOpen] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  const [projectSettingsSection, setProjectSettingsSection] = useState<'members' | 'baselines'>('members');
  const [isSetBaselineOpen, setIsSetBaselineOpen] = useState(false);
  const [isInsertSubprojectOpen, setIsInsertSubprojectOpen] = useState(false);
  const [currentSidebarView, setCurrentSidebarView] = useState<SidebarView>('main');
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const firestore = useFirestore();

  const projectDocRef = useMemoFirebase(() => projectId ? doc(firestore, 'projects', projectId) : null, [firestore, projectId]);
  const { data: project } = useDoc<Project>(projectDocRef);
  
  const handleOpenSettings = (section: 'members' | 'baselines') => {
    setProjectSettingsSection(section);
    setIsProjectSettingsOpen(true);
  };

  useEffect(() => {
    if (state.notifications && state.notifications.length > 0) {
      state.notifications.forEach(notif => {
        if (notif.type === 'toast') {
          toast({ title: notif.title, description: notif.description });
        }
      });
      dispatch({ type: 'CLEAR_NOTIFICATIONS' });
    }
  }, [state.notifications, dispatch, toast]);
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'h') {
            event.preventDefault();
            setIsFindReplaceOpen(true);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleFindReplace = (find: string, replace: string) => {
      dispatch({ type: 'FIND_AND_REPLACE', payload: { find, replace } });
      setIsFindReplaceOpen(false);
  };


  const selectedTask = useMemo(() => {
      let taskId: string | null = null;
      if (state.selectionMode === 'row' && state.selectedTaskIds.length > 0) {
          taskId = state.selectedTaskIds[state.selectedTaskIds.length - 1];
      } else if (state.selectionMode === 'cell' && state.focusCell) {
          taskId = state.focusCell.taskId;
      }
      return state.tasks.find(t => t.id === taskId) || null;
  }, [state.selectionMode, state.selectedTaskIds, state.focusCell, state.tasks]);
  
  const defaultCalendar = state.calendars.find(c => c.id === state.defaultCalendarId) || state.calendars[0] || null;
  const dateFormat = state.ganttSettings.dateFormat || 'MMM d, yyyy';

  const handleToggleMultiSelect = () => {
    dispatch({ type: 'TOGGLE_MULTI_SELECT_MODE' });
  };
  
  const zoomLevels: GanttSettings['viewMode'][] = ['day', 'week', 'month'];
  const currentZoomIndex = zoomLevels.indexOf(state.ganttSettings.viewMode);

  const handleZoomIn = () => {
    if (currentZoomIndex > 0) {
        const newViewMode = zoomLevels[currentZoomIndex - 1];
        dispatch({ type: 'UPDATE_GANTT_SETTINGS', payload: { ...state.ganttSettings, viewMode: newViewMode }});
    }
  };

  const handleZoomOut = () => {
      if (currentZoomIndex < zoomLevels.length - 1) {
          const newViewMode = zoomLevels[currentZoomIndex + 1];
          dispatch({ type: 'UPDATE_GANTT_SETTINGS', payload: { ...state.ganttSettings, viewMode: newViewMode }});
      }
  };

  const handleSetComparisonBaseline = (baselineId: string | null) => {
    dispatch({
        type: 'UPDATE_GANTT_SETTINGS',
        payload: {
            ...state.ganttSettings,
            comparisonBaselineId: baselineId
        }
    });
  };

  const handleSaveBaseline = (name: string) => {
      dispatch({ type: "ADD_BASELINE", payload: { name } });
      setIsSetBaselineOpen(false);
      toast({ title: "Baseline Saved" });
  };

  const handleSidebarNavigate = (view: SidebarView) => {
    if (view === 'print') {
        setIsPrintPreviewOpen(true);
        setCurrentSidebarView('main');
        return;
    }
    if (view === 'shortcuts') {
        setIsShortcutsDialogOpen(true);
        setCurrentSidebarView('main');
        return;
    }
    if (view === 'find-replace') {
        setIsFindReplaceOpen(true);
        setCurrentSidebarView('main');
        return;
    }
    setCurrentSidebarView(view);
  };

  const defaultSidebarContent = (
    <>
      <FileExplorer 
        projectState={state} 
        dispatch={dispatch}
        onPrintPreview={() => setIsPrintPreviewOpen(true)}
      />
      <Separator className="my-2" />
      {isLoaded && (
        <ViewOptions 
            dispatch={dispatch}
            uiDensity={state.uiDensity}
            views={state.views}
            currentViewId={state.currentViewId}
            isDirty={state.isDirty}
            isEditor={isEditorOrOwner}
        />
      )}
       <Separator className="my-2" />
      <ConflictDetector projectState={state} dispatch={dispatch} disabled={!isEditorOrOwner}/>
       <Separator className="my-2" />
      <SpatialView projectState={state} />
    </>
  );

  const canRemove = state.selectedTaskIds.length > 0;
  const canLink = state.selectedTaskIds.length > 1;

  // A task can be indented if it's selected and it's not the first task in the project.
  const firstSelectedTaskIndex = canRemove ? state.tasks.findIndex(t => t.id === state.selectedTaskIds[0]) : -1;
  const canIndent = canRemove && firstSelectedTaskIndex > 0;

  // A task can be outdented if it's selected and has a parent.
  const canOutdent = state.selectedTaskIds.some(id => !!state.tasks.find(t => t.id === id)?.parentId);

  const isButtonOnSide = state.ganttSettings.buttonLocation === 'side';

  const toolbarActions = (
    <div className={`flex ${isButtonOnSide ? 'flex-wrap gap-2 p-2' : 'items-center gap-2'}`}>
        {/* History */}
        {!isMobile && (
        <>
        <Button variant="outline" size="icon" onClick={() => dispatch({ type: 'UNDO' })} disabled={!canUndo || !isEditorOrOwner} title="Undo (Ctrl+Z)">
            <Undo2 />
        </Button>
        <Button variant="outline" size="icon" onClick={() => dispatch({ type: 'REDO' })} disabled={!canRedo || !isEditorOrOwner} title="Redo (Ctrl+Y)">
            <Redo2 />
        </Button>
        {!isButtonOnSide && <Separator orientation="vertical" className="h-6 mx-1" />}
        </>
        )}

        {/* Task Editing */}
        {/* Removed !isMobile check for core editing tools to ensure visibility */}
        <Button variant="outline" size="icon" onClick={() => dispatch({ type: 'ADD_TASK', payload: { id: crypto.randomUUID() } })} title="Add Task" disabled={!isEditorOrOwner}>
            <Plus />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setIsInsertSubprojectOpen(true)} title="Insert Project" disabled={!isEditorOrOwner}>
            <FolderTree className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => dispatch({ type: 'REMOVE_TASK' })} disabled={!canRemove || !isEditorOrOwner} title="Remove Selected Tasks">
            <Trash2 />
        </Button>

        <Button variant="outline" size="icon" onClick={() => dispatch({ type: 'INDENT_TASK' })} disabled={!canIndent || !isEditorOrOwner} title="Indent Task">
            <Indent />
        </Button>
        <Button variant="outline" size="icon" onClick={() => dispatch({ type: 'OUTDENT_TASK' })} disabled={!canOutdent || !isEditorOrOwner} title="Outdent Task">
            <Outdent />
        </Button>
        {!isButtonOnSide && <Separator orientation="vertical" className="h-6 mx-1" />}
        
        {/* View Manipulation */}
        <Button variant="outline" size="icon" onClick={() => dispatch({ type: 'COLLAPSE_ALL' })} title="Collapse Selection/All">
            <ChevronsUp />
        </Button>
        <Button variant="outline" size="icon" onClick={() => dispatch({ type: 'EXPAND_ALL' })} title="Expand Selection/All">
            <ChevronsDown />
        </Button>
        <Button variant="outline" size="icon" onClick={handleZoomOut} disabled={state.currentRepresentation !== 'gantt' || currentZoomIndex >= zoomLevels.length - 1} title="Zoom Out">
            <ZoomOut />
        </Button>
        <Button variant="outline" size="icon" onClick={handleZoomIn} disabled={state.currentRepresentation !== 'gantt' || currentZoomIndex <= 0} title="Zoom In">
            <ZoomIn />
        </Button>
        {isLoaded && !isMobile && (
          <>
            <ColumnSelector visibleColumns={state.visibleColumns} columns={state.columns} dispatch={dispatch} disabled={!isEditorOrOwner} />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsFilterDialogOpen(true)}
              title="Filter Tasks"
              disabled={!isEditorOrOwner}
              data-state={state.filters.length > 0 ? 'on' : 'off'}
              className="data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
            >
                <Filter className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsGroupingDialogOpen(true)}
              title="Group Tasks"
              disabled={!isEditorOrOwner}
              data-state={state.grouping.length > 0 ? 'on' : 'off'}
              className="data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
            >
                <FolderTree className="h-4 w-4" />
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        title="Manage Baselines"
                        data-state={state.ganttSettings.comparisonBaselineId ? 'on' : 'off'}
                        className="data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
                    >
                        <Layers />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuLabel>Compare to Baseline</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                        value={state.ganttSettings.comparisonBaselineId || 'none'}
                        onValueChange={(value) => handleSetComparisonBaseline(value === 'none' ? null : value)}
                    >
                        <DropdownMenuRadioItem value="none">None</DropdownMenuRadioItem>
                        {state.baselines.map(b => (
                            <DropdownMenuRadioItem key={b.id} value={b.id}>{b.name}</DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setIsSetBaselineOpen(true)} disabled={!isEditorOrOwner}>
                        Set Current as Baseline...
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleOpenSettings('baselines')} disabled={!project}>
                        Manage Baselines...
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        {!isMobile && (
        <>
        {!isButtonOnSide && <Separator orientation="vertical" className="h-6 mx-1" />}
        
        {/* More Tools */}
         <Button variant="outline" size="icon" onClick={() => setIsFindReplaceOpen(true)} title="Find and Replace (Ctrl+H)" disabled={!isEditorOrOwner}>
            <Search />
        </Button>
        {!isButtonOnSide && <Separator orientation="vertical" className="h-6 mx-1" />}
        <Button variant="outline" size="icon" onClick={() => setIsResourceDialogOpen(true)} title="Manage Resources" disabled={!isEditorOrOwner}>
            <Users />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setIsCalendarDialogOpen(true)} title="Manage Calendars" disabled={!isEditorOrOwner}>
            <CalendarDays />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setIsGanttSettingsOpen(true)} title="Gantt Display Options">
            <Settings />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setIsHistoryOpen(true)} title="Show History">
            <History />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setIsShortcutsDialogOpen(true)} title="Keyboard Shortcuts">
            <Keyboard />
        </Button>
        </>
        )}
    </div>
  );

  const sidebarContent = isMobile ? (
    <MobileSidebarContainer
        view={currentSidebarView}
        onNavigate={handleSidebarNavigate}
        projectState={state}
        dispatch={dispatch}
        defaultContent={defaultSidebarContent}
        history={history.log}
        historyIndex={history.index}
        onManageThemes={() => setIsThemeManagerOpen(true)}
        isEditor={isEditorOrOwner}
        canUndo={canUndo}
        canRedo={canRedo}
        canRemove={canRemove}
        user={user}
        currentProjectId={projectId}
        existingSubprojectIds={project?.subprojectIds}
    />
  ) : (
    <>
        {defaultSidebarContent}
        {isButtonOnSide && (
            <>
                <Separator className="my-2" />
                <div className="flex-1 overflow-y-auto">
                    {toolbarActions}
                </div>
            </>
        )}
    </>
  );

  const headerLeftActions = (
    <div className='flex items-center gap-2 overflow-x-auto min-w-0 [&::-webkit-scrollbar]:hidden'>
        <Button variant="ghost" size="icon" onClick={() => router.push('/')} title="Back to Projects">
            <ArrowLeft />
        </Button>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Toggle
          variant="outline"
          size="icon"
          pressed={state.multiSelectMode}
          onPressedChange={handleToggleMultiSelect}
          title="Toggle Multi-Select Mode"
          className="data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
        >
          <ListChecks />
        </Toggle>
        {isMobile && (
            <Button variant="outline" size="icon" onClick={() => setIsDetailsSheetOpen(true)} disabled={!selectedTask} title="View Task Details">
                <Info />
            </Button>
        )}
        <Button variant="outline" size="icon" onClick={() => dispatch({ type: 'LINK_TASKS' })} disabled={!canLink || !isEditorOrOwner} title="Link Selected Tasks">
            <LinkIcon />
        </Button>
        <Separator orientation="vertical" className="h-6 mx-1" />
        {/* View Type */}
        <ToggleGroup
            type="single"
            value={state.currentRepresentation}
            onValueChange={(value: Representation) => {
                if (value) dispatch({ type: 'SET_REPRESENTATION', payload: value })
            }}
            aria-label="View mode"
        >
            <ToggleGroupItem value="gantt" aria-label="Gantt view">
                <GanttChartSquare />
            </ToggleGroupItem>
            <ToggleGroupItem value="kanban" aria-label="Kanban view">
                <LayoutGrid />
            </ToggleGroupItem>
        </ToggleGroup>

        {!isButtonOnSide && (
            <>
                <Separator orientation="vertical" className="h-6 mx-1" />
                {toolbarActions}
            </>
        )}
    </div>
  );

  const headerRightActions = (
    <>
      <ProjectMembers projectId={projectId} firestore={firestore} user={user} />
      <Button variant="outline" size="icon" onClick={() => handleOpenSettings('members')} title="Project Settings" disabled={!project}>
        <Settings />
      </Button>
    </>
  );

  const renderContent = () => {
    if (!isLoaded) {
      return (
        <div className="flex items-center justify-center h-full">
          <p>Loading Project...</p>
        </div>
      );
    }

    if (state.currentRepresentation === 'kanban') {
      return <KanbanView projectState={state} dispatch={dispatch} />;
    }

    const ganttChartComponent = <GanttChart projectState={state} dispatch={dispatch} uiDensity={state.uiDensity} projectName={project?.name} />;

    if (isMobile) {
        return ganttChartComponent;
    }

    return (
      <ResizablePanelGroup direction="vertical">
        <ResizablePanel>
          {ganttChartComponent}
        </ResizablePanel>
        {selectedTask && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={35} minSize={20}>
              <TaskDetailsPanel 
                task={selectedTask} 
                projectState={state}
                dispatch={dispatch}
                onClose={() => dispatch({ type: 'UPDATE_SELECTION', payload: { mode: 'row', taskId: null } })}
                uiDensity={state.uiDensity}
                defaultCalendar={defaultCalendar}
                dateFormat={dateFormat}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    );
  };


  return (
    <>
    <ThemeManager theme={state.ganttSettings.theme} customStyles={state.ganttSettings.customStyles} />
    <MainLayout 
      sidebarContent={sidebarContent} 
      headerLeftActions={headerLeftActions}
      headerRightActions={headerRightActions}
      user={user}
    >
      <main className="flex-1 flex flex-col h-full">
        {renderContent()}
      </main>
      {isLoaded && (
        <>
          {isMobile && (
              <Sheet open={isDetailsSheetOpen} onOpenChange={setIsDetailsSheetOpen}>
                  <SheetContent side="left" className="p-0 flex flex-col w-fit min-w-[320px] max-w-[95vw] sm:w-auto sm:max-w-lg">
                    {selectedTask && (
                      <>
                        <SheetTitle className="sr-only">Task Details: {selectedTask.name}</SheetTitle>
                        <TaskDetailsPanel
                            task={selectedTask}
                            projectState={state}
                            dispatch={dispatch}
                            onClose={() => setIsDetailsSheetOpen(false)}
                            uiDensity={state.uiDensity}
                            defaultCalendar={defaultCalendar}
                            dateFormat={dateFormat}
                            layoutMode="vertical"
                        />
                      </>
                    )}
                  </SheetContent>
              </Sheet>
          )}
           {project && (
                <ProjectSettingsDialog
                    open={isProjectSettingsOpen}
                    onOpenChange={setIsProjectSettingsOpen}
                    project={project}
                    projectState={state}
                    allColumns={ALL_COLUMNS}
                    onProjectUpdate={() => {
                        // The project data will re-sync from Firestore automatically via the useDoc hook.
                        // No need to manually update state here.
                    }}
                    dispatch={dispatch}
                    initialOpenSection={projectSettingsSection}
                />
            )}
          <ResourceManagementDialog
            open={isResourceDialogOpen}
            onOpenChange={setIsResourceDialogOpen}
            projectState={state}
            dispatch={dispatch}
          />
          <CalendarManagementDialog
            open={isCalendarDialogOpen}
            onOpenChange={setIsCalendarDialogOpen}
            projectState={state}
            dispatch={dispatch}
          />
          <GroupingDialog
            open={isGroupingDialogOpen}
            onOpenChange={setIsGroupingDialogOpen}
            grouping={state.grouping}
            columns={state.columns}
            dispatch={dispatch}
            views={state.views}
            currentViewId={state.currentViewId}
            isDirty={state.isDirty}
          />
          <FilterDialog
            open={isFilterDialogOpen}
            onOpenChange={setIsFilterDialogOpen}
            filters={state.filters}
            columns={state.columns}
            dispatch={dispatch}
            views={state.views}
            currentViewId={state.currentViewId}
            isDirty={state.isDirty}
          />
          <GanttSettingsPanel
            open={isGanttSettingsOpen}
            onOpenChange={setIsGanttSettingsOpen}
            settings={state.ganttSettings}
            stylePresets={state.stylePresets}
            activeStylePresetId={state.activeStylePresetId}
            dispatch={dispatch}
            onManageThemes={() => setIsThemeManagerOpen(true)}
            isEditor={isEditorOrOwner}
            baselines={state.baselines}
          />
          <DetailedThemeEditor
            open={isThemeManagerOpen}
            onOpenChange={setIsThemeManagerOpen}
            settings={state.ganttSettings}
            stylePresets={state.stylePresets}
            onSave={(newSettings) => dispatch({ type: 'UPDATE_GANTT_SETTINGS', payload: newSettings })}
            dispatch={dispatch}
           />
          <HistoryPanel
            open={isHistoryOpen}
            onOpenChange={setIsHistoryOpen}
            history={history.log}
            currentIndex={history.index}
            dispatch={dispatch}
          />
          <KeyboardShortcutsDialog
            open={isShortcutsDialogOpen}
            onOpenChange={setIsShortcutsDialogOpen}
          />
          <FindReplaceDialog
            open={isFindReplaceOpen}
            onOpenChange={setIsFindReplaceOpen}
            onFindReplace={handleFindReplace}
          />
          <PrintPreviewDialog
            open={isPrintPreviewOpen}
            onOpenChange={setIsPrintPreviewOpen}
            projectState={state}
          />
          <SetBaselineDialog
              open={isSetBaselineOpen}
              onOpenChange={setIsSetBaselineOpen}
              onSave={handleSaveBaseline}
          />
          {project && (
            <SubprojectManagerDialog
                open={isInsertSubprojectOpen}
                onOpenChange={setIsInsertSubprojectOpen}
                user={user}
                currentProjectId={projectId}
                existingSubprojectIds={project.subprojectIds}
            />
          )}
        </>
      )}
    </MainLayout>
    </>
  );
}
