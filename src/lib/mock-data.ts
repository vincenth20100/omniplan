import type { Task, Link, Resource, Assignment, Calendar, Exception, Note } from './types';
import { addDays } from 'date-fns';

const today = new Date('2024-08-01T00:00:00.000Z');

export const initialCalendars: (Omit<Calendar, 'exceptions'> & { exceptions?: (Omit<Exception, 'start'|'finish'|'isActive'> & { start: string, finish: string, isActive?: boolean })[] })[] = [
    { 
        id: 'cal-standard', 
        name: 'Standard', 
        workingDays: [1, 2, 3, 4, 5], 
        exceptions: [
            { id: 'ex1', name: `New Year's Day`, start: `${today.getFullYear()}-01-01T00:00:00.000Z`, finish: `${today.getFullYear()}-01-01T00:00:00.000Z`, isActive: true },
            { id: 'ex2', name: 'Christmas Day', start: `${today.getFullYear()}-12-25T00:00:00.000Z`, finish: `${today.getFullYear()}-12-25T00:00:00.000Z`, isActive: true },
        ] 
    },
    { id: 'cal-247', name: '24/7', workingDays: [0, 1, 2, 3, 4, 5, 6], exceptions: [] },
    { id: 'cal-weekends', name: 'Weekends Only', workingDays: [0, 6], exceptions: [] },
];

export const initialTasks: (Omit<Task, 'start'|'finish'|'constraintDate'|'deadline'|'notes'> & {start: string, finish: string, constraintDate?:string, deadline?:string, notes?: (Omit<Note, 'timestamp'> & {timestamp: string})[]})[] = [
  { id: '1', wbs: '1', level: 0, name: 'Project Kick-off', start: today.toISOString(), duration: 1, durationUnit: 'd', finish: today.toISOString(), percentComplete: 100, cost: 500, status: 'Done', additionalNotes: 'This is some important, persistent information about the project kick-off. All stakeholders must be present.', notes: [
      { id: 'note-1', author: 'Project Manager', content: 'Initial project meeting went well. Team is motivated.', timestamp: addDays(today, -1).toISOString() }
  ], schedulingType: 'duration' },
  { id: '2', wbs: '2', level: 0, name: 'Requirement Gathering', start: addDays(today, 1).toISOString(), duration: 5, durationUnit: 'd', finish: addDays(today, 6).toISOString(), percentComplete: 75, cost: 2500, status: 'In Progress', deadline: addDays(today, 8).toISOString(), schedulingType: 'duration', work: 40 },
  { id: '3', wbs: '3', level: 0, name: 'Design Phase', start: addDays(today, 1).toISOString(), duration: 10, durationUnit: 'd', finish: addDays(today, 11).toISOString(), percentComplete: 50, cost: 5000, status: 'In Progress', schedulingType: 'duration', work: 40 },
  
  // Summary Task for Build
  { id: '4', wbs: '4', level: 0, name: 'Build', start: addDays(today, 8).toISOString(), duration: 0, durationUnit: 'd', finish: addDays(today, 23).toISOString(), percentComplete: 0, isSummary: true, isCollapsed: false, cost: 0, status: 'To Do', schedulingType: 'duration' },
  
  // Children of Build
  { id: '4.1', wbs: '4.1', parentId: '4', level: 1, name: 'Workshop Assembly', start: addDays(today, 8).toISOString(), duration: 15, durationUnit: 'd', finish: addDays(today, 23).toISOString(), percentComplete: 20, constraintType: 'Must Start On', constraintDate: addDays(today, 15).toISOString(), cost: 15000, status: 'To Do', schedulingType: 'duration', work: 120 },
  { id: '4.2', wbs: '4.2', parentId: '4', level: 1, name: 'Guidance Controls', start: addDays(today, 8).toISOString(), duration: 10, durationUnit: 'd', finish: addDays(today, 18).toISOString(), percentComplete: 40, cost: 10000, status: 'To Do', schedulingType: 'duration', work: 80 },
  
  { id: '5', wbs: '5', level: 0, name: 'Testing', start: addDays(today, 24).toISOString(), duration: 5, durationUnit: 'd', finish: addDays(today, 29).toISOString(), percentComplete: 0, cost: 2500, status: 'To Do', schedulingType: 'duration' },
  { id: '6', wbs: '6', level: 0, name: 'Deployment', start: addDays(today, 30).toISOString(), duration: 2, durationUnit: 'd', finish: addDays(today, 32).toISOString(), percentComplete: 0, cost: 1000, status: 'To Do', schedulingType: 'duration' },
];

export const initialLinks: Link[] = [
  { id: 'l1', source: '2', target: '4.1', type: 'FS', lag: 2 },
  { id: 'l2', source: '3', target: '4.1', type: 'FS', lag: 0 },
  { id: 'l3', source: '4.1', target: '5', type: 'FS', lag: 0 },
  { id: 'l4', source: '4.2', target: '5', type: 'FS', lag: 0 },
  { id: 'l5', source: '5', target: '6', type: 'FS', lag: 0 },
];

export const initialResources: Resource[] = [
    { id: 'r1', name: 'Project Manager', initials: 'PM', type: 'Work', category: 'Management', costPerHour: 100, availability: 1 },
    { id: 'r2', name: 'Business Analyst', initials: 'BA', type: 'Work', category: 'Management', costPerHour: 80, availability: 1 },
    { id: 'r3', name: 'Lead Designer', initials: 'LD', type: 'Work', category: 'Design', costPerHour: 90, availability: 1 },
    { id: 'r4', name: 'Lead Engineer', initials: 'LE', type: 'Work', category: 'Engineering', costPerHour: 120, availability: 1 },
    { id: 'r5', name: 'QA Engineer', initials: 'QA', type: 'Work', category: 'Engineering', costPerHour: 70, availability: 1 },
    { id: 'r6', name: 'DevOps Engineer', initials: 'DevOps', type: 'Work', category: 'Engineering', costPerHour: 110, availability: 1 },
    { id: 'r7', name: 'Steel Beams', initials: 'Steel', type: 'Material', category: 'Building Materials', costPerHour: 0, availability: 100 },
];

export const initialAssignments: Assignment[] = [
    { id: 'a1', taskId: '1', resourceId: 'r1', units: 1 },
    { id: 'a2', taskId: '2', resourceId: 'r2', units: 1 },
    { id: 'a3', taskId: '3', resourceId: 'r3', units: 0.5 },
    { id: 'a4', taskId: '4.1', resourceId: 'r4', units: 1 },
    { id: 'a5', taskId: '4.1', resourceId: 'r7', units: 10 },
    { id: 'a6', taskId: '4.2', resourceId: 'r4', units: 1 },
    { id: 'a7', taskId: '5', resourceId: 'r5', units: 1 },
    { id: 'a8', taskId: '6', resourceId: 'r6', units: 0.5 },
];
