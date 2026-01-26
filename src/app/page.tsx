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
import { Plus, Trash2, Users, CalendarDays, Link as LinkIcon, Indent, Outdent } from 'lucide-react';
import { SpatialView } from '@/components/spatial/spatial-view';
import { ConflictDetector } from '@/components/ai/conflict-detector';
import { useState } from 'react';
import { ResourceManagementDialog } from '@/components/resources/resource-management-dialog';
import { CalendarManagementDialog } from '@/components/calendars/calendar-management-dialog';
import { GroupingDialog } from '@/components/view-options/grouping-dialog';

export default function Home() {
  const { state, dispatch, isLoaded } = useProject();
  const [isResourceDialogOpen, setIsResourceDialogOpen] = useState(false);
  const [isCalendarDialogOpen, setIsCalendarDialogOpen] = useState(false);
  const [isGroupingDialogOpen, setIsGroupingDialogOpen] = useState(false);

  const lastSelectedId = state.selectedTaskIds[state.selectedTaskIds.length - 1];
  const selectedTask = state.tasks.find(t => t.id === lastSelectedId);

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

  const sidebarContent = (
    <>
      <FileExplorer projectState={state} dispatch={dispatch} />
      <Separator className="my-2" />
      {isLoaded && state.visibleColumns && (
        <ViewOptions 
            visibleColumns={state.visibleColumns}
            columns={state.columns}
            dispatch={dispatch}
            uiDensity={state.uiDensity}
            grouping={state.grouping}
            onOpenGroupingDialog={() => setIsGroupingDialogOpen(true)}
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
        <Button variant="outline" size="sm" onClick={handleAddTask}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Add Task</span>
        </Button>
        <Button variant="outline" size="sm" onClick={handleRemoveTask} disabled={state.selectedTaskIds.length === 0}>
            <Trash2 className="h-4 w-4" />
             <span className="hidden sm:inline ml-2">Remove Task</span>
        </Button>
        <Button variant="outline" size="sm" onClick={handleLinkTasks} disabled={state.selectedTaskIds.length < 2}>
            <LinkIcon className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Link</span>
        </Button>
        <Button variant="outline" size="sm" onClick={handleIndentTask} disabled={state.selectedTaskIds.length === 0 || state.grouping.length > 0}>
            <Indent className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleOutdentTask} disabled={state.selectedTaskIds.length === 0 || state.grouping.length > 0}>
            <Outdent className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setIsResourceDialogOpen(true)}>
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Resources</span>
        </Button>
        <Button variant="outline" size="sm" onClick={() => setIsCalendarDialogOpen(true)}>
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Calendars</span>
        </Button>
    </div>
  );

  const headerRightActions = null;

  return (
    <MainLayout 
      sidebarContent={sidebarContent} 
      headerLeftActions={headerLeftActions}
      headerRightActions={headerRightActions}
    >
      <div className="flex flex-col h-[calc(100vh-120px)] w-full">
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
      </div>
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
          />
        </>
      )}
    </MainLayout>
  );
}
