import type { Task, Link } from './types';
import { addDays } from 'date-fns';

const today = new Date();

export const initialTasks: Omit<Task, 'start' | 'finish' | 'constraintDate'>[] & { start: string, finish: string, constraintDate?: string } = [
  { id: '1', name: 'Project Kick-off', start: today.toISOString(), duration: 1, finish: today.toISOString(), percentComplete: 100 },
  { id: '2', name: 'Requirement Gathering', start: addDays(today, 1).toISOString(), duration: 5, finish: addDays(today, 6).toISOString(), percentComplete: 75 },
  { id: '3', name: 'Design Phase', start: addDays(today, 1).toISOString(), duration: 10, finish: addDays(today, 11).toISOString(), percentComplete: 50 },
  { id: '4', name: 'Development', start: addDays(today, 8).toISOString(), duration: 15, finish: addDays(today, 23).toISOString(), percentComplete: 20, constraintType: 'Must Start On', constraintDate: addDays(today, 15).toISOString() },
  { id: '5', name: 'Testing', start: addDays(today, 24).toISOString(), duration: 5, finish: addDays(today, 29).toISOString(), percentComplete: 0 },
  { id: '6', name: 'Deployment', start: addDays(today, 30).toISOString(), duration: 2, finish: addDays(today, 32).toISOString(), percentComplete: 0 },
];

export const initialLinks: Link[] = [
  { id: 'l1', source: '2', target: '4', type: 'FS', lag: 2 },
  { id: 'l2', source: '3', target: '4', type: 'FS', lag: 0 },
  { id: 'l3', source: '4', target: '5', type: 'FS', lag: 0 },
  { id: 'l4', source: '5', target: '6', type: 'FS', lag: 0 },
];
