'use client';

import { useEffect } from 'react';
import { apiPath } from '@/lib/api-path';
import { projectApi } from '@/services/project-api';
import { getPocketBase } from '@/lib/pocketbase';

export function useProjectSync(
  projectId: string | null,
  dispatch: React.Dispatch<any>
) {
  useEffect(() => {
    if (!projectId) return;

    const token = getPocketBase().authStore.token;
    const es = new EventSource(apiPath(`/api/events/${projectId}?token=${encodeURIComponent(token)}`));

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // On any change, refetch the affected table
        if (data.table === 'tasks') {
          projectApi.listTasks(projectId).then(tasks =>
            dispatch({ type: 'SYNC_TASKS', payload: tasks })
          );
        } else if (data.table === 'links') {
          projectApi.listLinks(projectId).then(links =>
            dispatch({ type: 'SYNC_LINKS', payload: links })
          );
        }
      } catch (e) {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // SSE will auto-reconnect
    };

    return () => es.close();
  }, [projectId, dispatch]);
}
