'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { GanttChart } from '@/components/omni-gantt/gantt-chart';
import { TaskDetailsPanel } from '@/components/details/task-details-panel';
import { useProject } from '@/hooks/use-project';
import { FileExplorer } from '@/components/file-management/file-explorer';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ViewOptions } from '@/components/view-options/view-options';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Users, CalendarDays, Link as LinkIcon, Indent, Outdent, ListChecks, ChevronsDown, ChevronsUp, Columns3, Filter, Layers, Settings, History, Undo2, Redo2 } from 'lucide-react';
import { SpatialView } from '@/components/spatial/spatial-view';
import { ConflictDetector } from '@/components/ai/conflict-detector';
import { useState } from 'react';
import { ResourceManagementDialog } from '@/components/resources/resource-management-dialog';
import { CalendarManagementDialog } from '@/components/calendars/calendar-management-dialog';
import { GroupingDialog } from '@/components/view-options/grouping-dialog';
import { FilterDialog } from '@/components/view-options/filter-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { ColumnSelector } from '@/components/layout/column-selector';
import { GanttSettingsPanel } from '@/components/gantt-settings/gantt-settings-panel';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { HistoryPanel } from '@/components/history/history-panel';
import type { User } from 'firebase/auth';

export function ProjectPage({ user }: { user: User }) {
  const { state, dispatch, isLoaded, canUndo, canRedo, history } = useProject(user);
  const [isResourceDialogOpen, setIsResourceDialogOpen] = useState(false);
  const [isCalendarDialogOpen, setIsCalendarDialogOpen] = useState(false);
  const [isGroupingDialogOpen, setIsGroupingDialogOpen] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isGanttSettingsOpen, setIsGanttSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const isMobile = useIsMobile();

  const lastSelectedId = state.selectedTaskIds[state.selectedTaskIds.length - 1];
  const selectedTask = state.tasks.find(t => t.id === lastSelectedId);
  const defaultCalendar = state.calendars.find(c => c.id === state.defaultCalendarId) || state.calendars[0] || null;

  const handleToggleMultiSelect = () => {
    dispatch({ type: 'TOGGLE_MULTI_SELECT_MODE' });
  };

  const sidebarContent = (
    <>
      <FileExplorer projectState={state} dispatch={dispatch} />
      <Separator className="my-2" />
      {isLoaded && (
        <ViewOptions 
            dispatch={dispatch}
            uiDensity={state.uiDensity}
            views={state.views}
            currentViewId={state.currentViewId}
            isDirty={state.isDirty}
        />
      )}
       <Separator className="my-2" />
      <ConflictDetector projectState={state} dispatch={dispatch} />
       <Separator className="my-2" />
      <SpatialView projectState={state} />
    </>
  );

  const headerLeftActions = (
    <div className='flex items-center gap-2'>
        <Button variant="outline" size="icon" onClick={() => dispatch({ type: 'UNDO' })} disabled={!canUndo} title="Undo (Ctrl+Z)">
            <Undo2 />
        </Button>
        <Button variant="outline" size="icon" onClick={() => dispatch({ type: 'REDO' })} disabled={!canRedo} title="Redo (Ctrl+Y)">
            <Redo2 />
        </Button>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Button variant="outline" size="icon" disabled title="Add Task">
            <Plus />
        </Button>
        <Button variant="outline" size="icon" disabled title="Remove Selected Tasks">
            <Trash2 />
        </Button>
        <Button variant="outline" size="icon" disabled title="Link Selected Tasks">
            <LinkIcon />
        </Button>
        <Button variant="outline" size="icon" disabled title="Indent Task">
            <Indent />
        </Button>
        <Button variant="outline" size="icon" disabled title="Outdent Task">
            <Outdent />
        </Button>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Button variant="outline" size="icon" disabled title="Collapse All">
            <ChevronsUp />
        </Button>
        <Button variant="outline" size="icon" disabled title="Expand All">
            <ChevronsDown />
        </Button>
        <Separator orientation="vertical" className="h-6 mx-1" />
        
        {isLoaded && (
          <>
            <ColumnSelector visibleColumns={state.visibleColumns} columns={state.columns} dispatch={dispatch} />
            <Button variant={state.filters.length > 0 ? "secondary" : "outline"} size="icon" onClick={() => setIsFilterDialogOpen(true)} title="Filter Tasks">
                <Filter className="h-4 w-4" />
            </Button>
            <Button variant={state.grouping.length > 0 ? "secondary" : "outline"} size="icon" onClick={() => setIsGroupingDialogOpen(true)} title="Group Tasks">
                <Layers className="h-4 w-4" />
            </Button>
          </>
        )}
        
        <Separator orientation="vertical" className="h-6 mx-1" />
        
        <Button variant="outline" size="icon" onClick={() => setIsResourceDialogOpen(true)} title="Manage Resources">
            <Users />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setIsCalendarDialogOpen(true)} title="Manage Calendars">
            <CalendarDays />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setIsGanttSettingsOpen(true)} title="Gantt Display Options">
            <Settings />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setIsHistoryOpen(true)} title="Show History">
            <History />
        </Button>
        {isMobile && (
            <Button
                variant={state.multiSelectMode ? "secondary" : "outline"}
                size="sm"
                onClick={handleToggleMultiSelect}
                className="w-9 px-0"
                title="Toggle Multi-Select"
            >
                <ListChecks />
            </Button>
        )}
    </div>
  );

  const headerRightActions = null;

  return (
    <MainLayout 
      sidebarContent={sidebarContent} 
      headerLeftActions={headerLeftActions}
      headerRightActions={headerRightActions}
      user={user}
    >
      <main className="flex-1 flex flex-col h-full">
        {isLoaded ? (
          isMobile ? (
            <GanttChart projectState={state} dispatch={dispatch} uiDensity={state.uiDensity} />
          ) : (
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
                      onClose={() => dispatch({ type: 'SELECT_TASK', payload: { taskId: null } })}
                      uiDensity={state.uiDensity}
                      defaultCalendar={defaultCalendar}
                    />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          )
        ) : (
          <div className="flex items-center justify-center h-full">
            <p>Loading Project...</p>
          </div>
        )}
      </main>
      {isLoaded && (
        <>
          {isMobile && (
            <Sheet open={!!selectedTask} onOpenChange={(open) => !open && dispatch({ type: 'SELECT_TASK', payload: { taskId: null } })}>
                <SheetContent side="bottom" className="h-[80vh] p-0">
                {selectedTask && (
                    <TaskDetailsPanel 
                        task={selectedTask} 
                        links={state.links} 
                        tasks={state.tasks}
                        dispatch={dispatch}
                        onClose={() => dispatch({ type: 'SELECT_TASK', payload: { taskId: null } })}
                        uiDensity={state.uiDensity}
                        defaultCalendar={defaultCalendar}
                    />
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
          />
          <HistoryPanel
            open={isHistoryOpen}
            onOpenChange={setIsHistoryOpen}
            history={history.log}
            currentIndex={history.index}
            dispatch={dispatch}
          />
        </>
      )}
    </MainLayout>
  );
}
