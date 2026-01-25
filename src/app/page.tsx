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
import { Plus, Trash2 } from 'lucide-react';
import { SpatialView } from '@/components/spatial/spatial-view';
import { ConflictDetector } from '@/components/ai/conflict-detector';

export default function Home() {
  const { state, dispatch, isLoaded } = useProject();

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

  const sidebarContent = (
    <>
      <FileExplorer />
      <Separator className="my-2" />
      {isLoaded && state.visibleColumns && (
        <ViewOptions visibleColumns={state.visibleColumns} dispatch={dispatch} />
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
    </div>
  );

  return (
    <MainLayout 
      sidebarContent={sidebarContent} 
      headerLeftActions={headerLeftActions}
    >
      <div className="flex flex-col h-[calc(100vh-120px)] w-full">
        {isLoaded ? (
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel>
              <GanttChart projectState={state} dispatch={dispatch} />
            </ResizablePanel>
            {selectedTask && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={35} minSize={20}>
                  <TaskDetailsPanel 
                    task={selectedTask} 
                    links={state.links} 
                    tasks={state.tasks}
                    onClose={() => dispatch({ type: 'SELECT_TASK', payload: { taskId: null } })}
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
    </MainLayout>
  );
}
