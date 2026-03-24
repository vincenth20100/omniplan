'use client';

import { apiPath } from '@/lib/api-path';

function getAuthToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem('pocketbase_auth');
    return raw ? JSON.parse(raw)?.token ?? '' : '';
  } catch {
    return '';
  }
}

function authHeaders(): HeadersInit {
  return {
    'Authorization': `Bearer ${getAuthToken()}`,
    'Content-Type': 'application/json',
  };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiPath(path), {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as any).error ?? `API error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const projectApi = {
  // Projects
  listProjects: () => apiFetch<any[]>('/api/projects'),
  createProject: (data: { name: string; settings?: any }) =>
    apiFetch<any>('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  getProject: (id: string) => apiFetch<any>(`/api/projects/${id}`),
  updateProject: (id: string, data: Partial<any>) =>
    apiFetch<any>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProject: (id: string) =>
    apiFetch<void>(`/api/projects/${id}`, { method: 'DELETE' }),

  // Tasks
  listTasks: (projectId: string) => apiFetch<any[]>(`/api/projects/${projectId}/tasks`),
  createTask: (projectId: string, data: any) =>
    apiFetch<any>(`/api/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (projectId: string, taskId: string, data: any) =>
    apiFetch<any>(`/api/projects/${projectId}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTask: (projectId: string, taskId: string) =>
    apiFetch<void>(`/api/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' }),

  // Links
  listLinks: (projectId: string) => apiFetch<any[]>(`/api/projects/${projectId}/links`),
  createLink: (projectId: string, data: any) =>
    apiFetch<any>(`/api/projects/${projectId}/links`, { method: 'POST', body: JSON.stringify(data) }),
  deleteLink: (projectId: string, linkId: string) =>
    apiFetch<void>(`/api/projects/${projectId}/links/${linkId}`, { method: 'DELETE' }),

  // Resources
  listResources: (projectId: string) => apiFetch<any[]>(`/api/projects/${projectId}/resources`),
  createResource: (projectId: string, data: any) =>
    apiFetch<any>(`/api/projects/${projectId}/resources`, { method: 'POST', body: JSON.stringify(data) }),
  updateResource: (projectId: string, data: any) =>
    apiFetch<any>(`/api/projects/${projectId}/resources`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteResource: (projectId: string, data: { id: string }) =>
    apiFetch<void>(`/api/projects/${projectId}/resources`, { method: 'DELETE', body: JSON.stringify(data) }),

  // Assignments
  listAssignments: (projectId: string) => apiFetch<any[]>(`/api/projects/${projectId}/assignments`),
  createAssignment: (projectId: string, data: any) =>
    apiFetch<any>(`/api/projects/${projectId}/assignments`, { method: 'POST', body: JSON.stringify(data) }),
  deleteAssignment: (projectId: string, data: { id: string }) =>
    apiFetch<void>(`/api/projects/${projectId}/assignments`, { method: 'DELETE', body: JSON.stringify(data) }),

  // Schedule
  recalculateSchedule: (projectId: string) =>
    apiFetch<{ updated: number }>(`/api/projects/${projectId}/schedule`, { method: 'POST' }),
};
