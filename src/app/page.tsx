'use client';

import { MainLayout } from '@/components/layout/main-layout';
import { GanttChart } from '@/components/omni-gantt/gantt-chart';
import { TaskDetailsPanel } from '@/components/details/task-details-panel';
import { useProject } from '@/hooks/use-project';
import { ConflictDetector } from '@/components/ai/conflict-detector';
import { SpatialView } from '@/components/spatial/spatial-view';
import { Separator } from '@/components/ui/separator';

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

  return (
    <MainLayout sidebarContent={sidebarContent}>
      <div className="flex flex-col h-[calc(100vh-120px)] w-full">
        {isLoaded ? (
            <GanttChart projectState={state} dispatch={dispatch} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p>Loading Project...</p>
          </div>
        )}
      </div>
      {selectedTask && (
        <TaskDetailsPanel 
          task={selectedTask} 
          links={state.links} 
          tasks={state.tasks}
          onClose={() => dispatch({ type: 'SELECT_TASK', payload: null })}
        />
      )}
    </MainLayout>
  );
}
