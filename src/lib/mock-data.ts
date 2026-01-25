import type { Task, Link } from './types';
import { addDays } from 'date-fns';

const today = new Date('2024-08-01T00:00:00.000Z');

export const initialTasks: Omit<Task, 'start' | 'finish' | 'constraintDate' | 'cost'>[] & { start: string, finish: string, constraintDate?: string, cost?: number } = [
  { id: '1', wbs: '1', level: 0, name: 'Project Kick-off', start: today.toISOString(), duration: 1, finish: today.toISOString(), percentComplete: 100, cost: 500 },
  { id: '2', wbs: '2', level: 0, name: 'Requirement Gathering', start: addDays(today, 1).toISOString(), duration: 5, finish: addDays(today, 6).toISOString(), percentComplete: 75, cost: 2500 },
  { id: '3', wbs: '3', level: 0, name: 'Design Phase', start: addDays(today, 1).toISOString(), duration: 10, finish: addDays(today, 11).toISOString(), percentComplete: 50, cost: 5000 },
  
  // Summary Task for Build
  { id: '4', wbs: '4', level: 0, name: 'Build', isSummary: true, start: addDays(today, 8).toISOString(), duration: 0, finish: addDays(today, 23).toISOString(), percentComplete: 0, isCollapsed: false, cost: 0 },
  
  // Children of Build
  { id: '4.1', wbs: '4.1', parentId: '4', level: 1, name: 'Workshop Assembly', start: addDays(today, 8).toISOString(), duration: 15, finish: addDays(today, 23).toISOString(), percentComplete: 20, constraintType: 'Must Start On', constraintDate: addDays(today, 15).toISOString(), cost: 15000 },
  { id: '4.2', wbs: '4.2', parentId: '4', level: 1, name: 'Guidance Controls', start: addDays(today, 8).toISOString(), duration: 10, finish: addDays(today, 18).toISOString(), percentComplete: 40, cost: 10000 },
  
  { id: '5', wbs: '5', level: 0, name: 'Testing', start: addDays(today, 24).toISOString(), duration: 5, finish: addDays(today, 29).toISOString(), percentComplete: 0, cost: 2500 },
  { id: '6', wbs: '6', level: 0, name: 'Deployment', start: addDays(today, 30).toISOString(), duration: 2, finish: addDays(today, 32).toISOString(), percentComplete: 0, cost: 1000 },
];

export const initialLinks: Link[] = [
  { id: 'l1', source: '2', target: '4.1', type: 'FS', lag: 2 },
  { id: 'l2', source: '3', target: '4.1', type: 'FS', lag: 0 },
  { id: 'l3', source: '4.1', target: '5', type: 'FS', lag: 0 },
  { id: 'l4', source: '4.2', target: '5', type: 'FS', lag: 0 },
  { id: 'l5', source: '5', target: '6', type: 'FS', lag: 0 },
];
