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
import { Plus, Trash2, Users, CalendarDays, Link as LinkIcon, Indent, Outdent, ListChecks, ChevronsDown, ChevronsUp, Columns3, Filter, Layers, Settings, History, Undo2, Redo2, Keyboard, Info, Search, GanttChartSquare, LayoutGrid, ZoomIn, ZoomOut } from 'lucide-react';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Representation, GanttSettings, ProjectMember } from '@/lib/types';
import { PrintPreviewDialog } from './print-preview';
import { ProjectMembers } from './project-members';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

const ThemeManager = ({ theme, customStyles }: { theme: GanttSettings['theme'], customStyles: GanttSettings['customStyles'] }) => {
  useEffect(() => {
    document.documentElement.className = theme || 'dark';
  }, [theme]);

  const css = useMemo(() => {
    if (!customStyles) return '';
    
    const varMap: { [key: string]: string } = {
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
        const cssVarName = varMap[key];
        return cssVarName && value ? `${cssVarName}: ${value};` : null;
      })
      .filter(Boolean);

    if (styleEntries.length === 0) return '';
    
    return `:root { ${styleEntries.join(' ')} }`;
  }, [customStyles]);

  if (!css) return null;

  return <style>{css}</style>;
};


export function ProjectPage({ user, projectId }: { user: User, projectId: string }) {
  const { state, dispatch, isLoaded, isEditorOrOwner, canUndo, canRedo, history } = useProject(user, projectId);
  const [isResourceDialogOpen, setIsResourceDialogOpen] = useState(false);
  const [isCalendarDialogOpen, setIsCalendarDialogOpen] = useState(false);
  const [isGroupingDialogOpen, setIsGroupingDialogOpen] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isGanttSettingsOpen, setIsGanttSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = useState(false);
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const firestore = useFirestore();

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


  const lastSelectedId = state.selectedTaskIds[state.selectedTaskIds.length - 1];
  const selectedTask = state.tasks.find(t => t.id === lastSelectedId);
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

  const sidebarContent = (
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

  const headerLeftActions = (
    <div className='flex items-center gap-2'>
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
        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* History */}
        <Button variant="outline" size="icon" onClick={() => dispatch({ type: 'UNDO' })} disabled={!canUndo || !isEditorOrOwner} title="Undo (Ctrl+Z)">
            <Undo2 />
        </Button>
        <Button variant="outline" size="icon" onClick={() => dispatch({ type: 'REDO' })} disabled={!canRedo || !isEditorOrOwner} title="Redo (Ctrl+Y)">
            <Redo2 />
        </Button>
        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Task Editing */}
        <Button variant="outline" size="icon" onClick={() => dispatch({ type: 'ADD_TASK' })} title="Add Task" disabled={!isEditorOrOwner}>
            <Plus />
        </Button>
        <Button variant="outline" size="icon" onClick={() => dispatch({ type: 'REMOVE_TASK' })} disabled={!canRemove || !isEditorOrOwner} title="Remove Selected Tasks">
            <Trash2 />
        </Button>
        <Button variant="outline" size="icon" onClick={() => dispatch({ type: 'LINK_TASKS' })} disabled={!canLink || !isEditorOrOwner} title="Link Selected Tasks">
            <LinkIcon />
        </Button>
        <Button variant="outline" size="icon" onClick={() => dispatch({ type: 'INDENT_TASK' })} disabled={!canIndent || !isEditorOrOwner} title="Indent Task">
            <Indent />
        </Button>
        <Button variant="outline" size="icon" onClick={() => dispatch({ type: 'OUTDENT_TASK' })} disabled={!canOutdent || !isEditorOrOwner} title="Outdent Task">
            <Outdent />
        </Button>
        <Separator orientation="vertical" className="h-6 mx-1" />
        
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
        {isLoaded && (
          <>
            <ColumnSelector visibleColumns={state.visibleColumns} columns={state.columns} dispatch={dispatch} disabled={!isEditorOrOwner} />
            <Button variant={state.filters.length > 0 ? "secondary" : "outline"} size="icon" onClick={() => setIsFilterDialogOpen(true)} title="Filter Tasks" disabled={!isEditorOrOwner}>
                <Filter className="h-4 w-4" />
            </Button>
            <Button variant={state.grouping.length > 0 ? "secondary" : "outline"} size="icon" onClick={() => setIsGroupingDialogOpen(true)} title="Group Tasks" disabled={!isEditorOrOwner}>
                <Layers className="h-4 w-4" />
            </Button>
          </>
        )}
        <Separator orientation="vertical" className="h-6 mx-1" />
        
        {/* Tools */}
        <Button variant={state.multiSelectMode ? "secondary" : "outline"} size="icon" onClick={handleToggleMultiSelect} title="Toggle Multi-Select Mode">
          <ListChecks />
        </Button>
        {isMobile && (
            <Button variant="outline" size="icon" onClick={() => setIsMobileSheetOpen(true)} disabled={!selectedTask} title="View Task Details">
                <Info />
            </Button>
        )}
         <Button variant="outline" size="icon" onClick={() => setIsFindReplaceOpen(true)} title="Find and Replace (Ctrl+H)" disabled={!isEditorOrOwner}>
            <Search />
        </Button>
        <Separator orientation="vertical" className="h-6 mx-1" />
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
    </div>
  );

  const headerRightActions = (
    <>
      <ProjectMembers projectId={projectId} firestore={firestore} />
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

    if (isMobile) {
      return <GanttChart projectState={state} dispatch={dispatch} uiDensity={state.uiDensity} />;
    }

    return (
      <ResizablePanelGroup direction="vertical">
        <ResizablePanel>
          <GanttChart projectState={state} dispatch={dispatch} uiDensity={state.uiDensity} />
        </ResizablePanel>
        {selectedTask && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={35} minSize={20}>
              <TaskDetailsPanel 
                task={selectedTask} 
                links={state.links} 
                tasks={state.tasks}
                dispatch={dispatch}
                onClose={() => dispatch({ type: 'SET_SELECTION', payload: { activeCell: null, selectionAnchorCell: null, selectedTaskIds: [], selectedCells: [] } })}
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
            <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
                <SheetContent side="bottom" className="h-[80vh] p-0">
                  {selectedTask && (
                    <>
                      <SheetTitle className="sr-only">Task Details: {selectedTask.name}</SheetTitle>
                      <TaskDetailsPanel 
                          task={selectedTask} 
                          links={state.links} 
                          tasks={state.tasks}
                          dispatch={dispatch}
                          onClose={() => setIsMobileSheetOpen(false)}
                          uiDensity={state.uiDensity}
                          defaultCalendar={defaultCalendar}
                          dateFormat={dateFormat}
                      />
                    </>
                  )}
                </SheetContent>
            </Sheet>
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
            dispatch={dispatch}
            isEditor={isEditorOrOwner}
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
        </>
      )}
    </MainLayout>
    </>
  );
}
