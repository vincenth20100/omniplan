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
import { Plus, Trash2, Users, CalendarDays, Link as LinkIcon, Indent, Outdent, ListChecks, ChevronsDown, ChevronsUp, Columns3, Filter, Layers } from 'lucide-react';
import { SpatialView } from '@/components/spatial/spatial-view';
import { ConflictDetector } from '@/components/ai/conflict-detector';
import { useState } from 'react';
import { ResourceManagementDialog } from '@/components/resources/resource-management-dialog';
import { CalendarManagementDialog } from '@/components/calendars/calendar-management-dialog';
import { GroupingDialog } from '@/components/view-options/grouping-dialog';
import { FilterDialog } from '@/components/view-options/filter-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { ColumnSelector } from '@/components/layout/column-selector';

export default function Home() {
  const { state, dispatch, isLoaded } = useProject();
  const [isResourceDialogOpen, setIsResourceDialogOpen] = useState(false);
  const [isCalendarDialogOpen, setIsCalendarDialogOpen] = useState(false);
  const [isGroupingDialogOpen, setIsGroupingDialogOpen] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const isMobile = useIsMobile();

  const lastSelectedId = state.selectedTaskIds[state.selectedTaskIds.length - 1];
  const selectedTask = state.tasks.find(t => t.id === lastSelectedId);
  const defaultCalendar = state.calendars.find(c => c.id === state.defaultCalendarId) || state.calendars[0] || null;

  const handleAddTask = () => {
    dispatch({ type: 'ADD_TASK' });
  };

  const handleRemoveTask = () => {
    if (state.selectedTaskIds.length > 0) {
      // TODO: Add a confirmation dialog
      dispatch({ type: 'REMOVE_TASK' });
    }
  };
  
  const handleLinkTasks = () => {
    dispatch({ type: 'LINK_TASKS' });
  };

  const handleIndentTask = () => {
    dispatch({ type: 'INDENT_TASK' });
  };

  const handleOutdentTask = () => {
    dispatch({ type: 'OUTDENT_TASK' });
  };

  const handleToggleMultiSelect = () => {
    dispatch({ type: 'TOGGLE_MULTI_SELECT_MODE' });
  };

  const handleExpandAll = () => {
    dispatch({ type: 'EXPAND_ALL' });
  };

  const handleCollapseAll = () => {
    dispatch({ type: 'COLLAPSE_ALL' });
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
        <Button variant="outline" size="icon" onClick={handleAddTask}>
            <Plus />
        </Button>
        <Button variant="outline" size="icon" onClick={handleRemoveTask} disabled={state.selectedTaskIds.length === 0}>
            <Trash2 />
        </Button>
        <Button variant="outline" size="icon" onClick={handleLinkTasks} disabled={state.selectedTaskIds.length < 2}>
            <LinkIcon />
        </Button>
        <Button variant="outline" size="icon" onClick={handleIndentTask} disabled={state.selectedTaskIds.length === 0 || state.grouping.length > 0}>
            <Indent />
        </Button>
        <Button variant="outline" size="icon" onClick={handleOutdentTask} disabled={state.selectedTaskIds.length === 0 || state.grouping.length > 0}>
            <Outdent />
        </Button>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Button variant="outline" size="icon" onClick={handleCollapseAll} disabled={state.grouping.length > 0}>
            <ChevronsUp />
        </Button>
        <Button variant="outline" size="icon" onClick={handleExpandAll} disabled={state.grouping.length > 0}>
            <ChevronsDown />
        </Button>
        <Separator orientation="vertical" className="h-6 mx-1" />
        
        {isLoaded && (
          <>
            <ColumnSelector visibleColumns={state.visibleColumns} columns={state.columns} dispatch={dispatch} />
            <Button variant={state.filters.length > 0 ? "secondary" : "outline"} size="icon" onClick={() => setIsFilterDialogOpen(true)}>
                <Filter className="h-4 w-4" />
            </Button>
            <Button variant={state.grouping.length > 0 ? "secondary" : "outline"} size="icon" onClick={() => setIsGroupingDialogOpen(true)}>
                <Layers className="h-4 w-4" />
            </Button>
          </>
        )}
        
        <Separator orientation="vertical" className="h-6 mx-1" />
        
        <Button variant="outline" size="icon" onClick={() => setIsResourceDialogOpen(true)}>
            <Users />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setIsCalendarDialogOpen(true)}>
            <CalendarDays />
        </Button>
        {isMobile && (
            <Button
                variant={state.multiSelectMode ? "secondary" : "outline"}
                size="sm"
                onClick={handleToggleMultiSelect}
                className="w-9 px-0"
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
    >
      <main className="flex-1 flex flex-col h-full min-w-0">
        {isLoaded ? (
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
        ) : (
          <div className="flex items-center justify-center h-full">
            <p>Loading Project...</p>
          </div>
        )}
      </main>
      {isLoaded && (
        <>
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
        </>
      )}
    </MainLayout>
  );
}
