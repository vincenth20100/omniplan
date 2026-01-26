export type LinkType = "FS" | "SS" | "FF" | "SF";

export type ConstraintType = "Start No Earlier Than" | "Must Start On";

export type UiDensity = 'compact' | 'medium' | 'large';

export interface Calendar {
  id: string;
  name: string;
  workingDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
}

export interface Task {
  id: string;
  name: string;
  start: Date;
  finish: Date;
  duration: number; // in working days
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
  zoneId?: string | null;
  customAttributes?: Record<string, any> | null;
  calendarId?: string | null;

  // Calculated fields
  schedulingConflict?: boolean;
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
  width: number;
}

export interface ProjectState {
    tasks: Task[];
    links: Link[];
    resources: Resource[];
    assignments: Assignment[];
    zones: Zone[];
    calendars: Calendar[];
    defaultCalendarId: string | null;
    historyLog: any[];
    selectedTaskIds: string[];
    visibleColumns: string[];
    columns: ColumnSpec[];
    uiDensity: UiDensity;
}
