'use client';
export type LinkType = "FS" | "SS" | "FF" | "SF";

export type ConstraintType = 
  | "Finish No Earlier Than"
  | "Finish No Later Than"
  | "Must Finish On"
  | "Must Start On"
  | "Start No Earlier Than"
  | "Start No Later Than";

export type UiDensity = 'compact' | 'medium' | 'large';

export type DurationUnit = 'd' | 'm' | 'ed' | 'em';

export interface Exception {
  id: string;
  name: string;
  start: Date;
  finish: Date;
  isActive?: boolean;
}

export interface Calendar {
  id: string;
  name: string;
  workingDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  exceptions?: Exception[];
  nonWorkingDayOverrides?: string[]; // ISO date strings yyyy-mm-dd
  workingDayOverrides?: string[]; // ISO date strings yyyy-mm-dd
}

export interface NoteAttachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'file';
}

export interface Note {
  id: string;
  author: string;
  content: string;
  timestamp: Date;
  attachments?: NoteAttachment[];
}

export interface Task {
  id: string;
  name: string;
  start: Date;
  finish: Date;
  duration: number; // in the unit specified by durationUnit
  durationUnit?: DurationUnit; // d: working days, m: months, ed: elapsed days, em: elapsed months
  percentComplete: number;
  cost?: number;
  
  // New properties for hierarchy
  wbs?: string; // Work Breakdown Structure ID
  parentId?: string | null;
  level?: number;
  isSummary?: boolean;
  isCollapsed?: boolean;

  constraintType?: ConstraintType | null;
  constraintDate?: Date | null;
  deadline?: Date | null;
  zoneId?: string | null;
  customAttributes?: Record<string, any> | null;
  calendarId?: string | null;
  additionalNotes?: string;
  notes?: Note[];

  // Calculated fields
  schedulingConflict?: boolean;
  deadlineMissed?: boolean;
  isCritical?: boolean;
  totalFloat?: number; // in working days
  lateStart?: Date;
  lateFinish?: Date;
}

export interface Link {
  id: string;
  source: string; // task id
  target: string; // task id
  type: LinkType;
  lag: number; // in working days
  
  // Calculated
  isDriving?: boolean;
}

export interface Zone {
    id: string;
    name: string;
    coordinates: Array<{ lat: number; lng: number }>;
}

export interface Resource {
  id: string;
  name: string;
  type: 'Work' | 'Material' | 'Cost';
  costPerHour?: number;
  availability?: number; // e.g. 1 = 100%
  calendarId?: string | null;
}

export interface Assignment {
  id: string;
  taskId: string;
  resourceId: string;
  units?: number; // e.g. 1 = 100% of resource time
}

export interface ColumnSpec {
  id: string;
  name: string;
  width: number;
  type?: 'text' | 'number' | 'selection' | 'date';
  options?: string[];
}

export interface Filter {
  id: string;
  columnId: string;
  operator: string;
  value: any;
}

export interface View {
  id: string;
  name: string;
  grouping: string[];
  visibleColumns: string[];
  filters: Filter[];
}

export interface GanttSettings {
  viewMode: 'day' | 'week' | 'month';
  showDependencies: boolean;
  showProgress: boolean;
  highlightNonWorkingTime: boolean;
  showTodayLine: boolean;
  showTaskLabels: boolean;
  highlightCriticalPath: boolean;
}

export interface HistoryEntry {
    actionType: string;
    timestamp: Date;
    payloadDescription?: string;
}

export interface ProjectState {
    tasks: Task[];
    links: Link[];
    resources: Resource[];
    assignments: Assignment[];
    zones: Zone[];
    calendars: Calendar[];
    defaultCalendarId: string | null;
    selectedTaskIds: string[];
    visibleColumns: string[];
    columns: ColumnSpec[];
    uiDensity: UiDensity;
    grouping: string[];
    filters: Filter[];
    views: View[];
    currentViewId: string | null;
    isDirty?: boolean;
    multiSelectMode?: boolean;
    activeCell?: { taskId: string, columnId: string } | null;
    editingCell?: { taskId: string, columnId: string, initialValue?: string } | null;
    ganttSettings: GanttSettings;
}
