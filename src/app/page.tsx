'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { GanttChart } from '@/components/omni-gantt/gantt-chart';
import { TaskDetailsPanel } from '@/components/details/task-details-panel';
import { useProject } from '@/hooks/use-project';
import { ConflictDetector } from '@/components/ai/conflict-detector';
import { SpatialView } from '@/components/spatial/spatial-view';
import { Separator } from '@/components/ui/separator';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Layers, Filter } from 'lucide-react';
import { ColumnSelector } from '@/components/layout/column-selector';

export default function Home() {
  const { state, dispatch, isLoaded } = useProject();

  const selectedTask = state.tasks.find(t => t.id === state.selectedTaskId);

  const sidebarContent = (
    <div>
      <ConflictDetector projectState={state} dispatch={dispatch} />
      <Separator className="my-4"/>
      <SpatialView projectState={state} />
    </div>
  );

  const headerActions = (
    <>
      <Button variant="outline" size="sm" disabled>
        <Filter className="mr-2 h-4 w-4" />
        Filter
      </Button>
      <Button variant="outline" size="sm" disabled>
        <Layers className="mr-2 h-4 w-4" />
        Group
      </Button>
      {isLoaded && state.visibleColumns && <ColumnSelector visibleColumns={state.visibleColumns} dispatch={dispatch} />}
    </>
  );

  return (
    <MainLayout sidebarContent={sidebarContent} headerActions={headerActions}>
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
                    onClose={() => dispatch({ type: 'SELECT_TASK', payload: null })}
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
