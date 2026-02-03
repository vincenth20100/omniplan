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

export type SelectionMode = 'row' | 'cell';

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
  order?: number;
  cost?: number;
  status: string;
  
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

  // Effort-driven properties
  work?: number; // Total labor hours
  schedulingType?: 'duration' | 'effort'; // Defaults to 'duration'

  // Calculated fields
  schedulingConflict?: boolean;
  deadlineMissed?: boolean;
  isCritical?: boolean;
  criticalFor?: string[]; // IDs of projects for which this task is critical
  totalFloat?: number; // in working days
  lateStart?: Date;
  lateFinish?: Date;

  // Multi-project support
  projectId?: string;
  projectName?: string; // Computed property for display
  projectInitials?: string;
  isGhost?: boolean;
}

export interface Link {
  id: string;
  source: string; // task id
  target: string; // task id
  type: LinkType;
  lag: number; // in working days
  
  // Optional for cross-project links
  sourceProjectId?: string;
  targetProjectId?: string;

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
  initials?: string;
  type: 'Work' | 'Material' | 'Cost';
  category?: string;
  costPerHour?: number;
  availability?: number; // e.g. 1 = 100%
  calendarId?: string | null;
  order?: number;
}

export interface Assignment {
  id: string;
  taskId: string;
  resourceId: string;
  units?: number; // e.g. 100% of resource time
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
  renderSplitTasks?: boolean;
  dateFormat?: string;
  summaryDurationUnit?: 'day' | 'week' | 'month';
  theme?: 'light' | 'dark' | 'sepia';
  customStyles?: Record<string, string>;
  comparisonBaselineId?: string | null;
  buttonLocation?: 'top' | 'side';
}

export interface StylePreset {
  id: string;
  name: string;
  isDefault?: boolean;
  settings: {
    theme: 'light' | 'dark' | 'sepia';
    customStyles?: GanttSettings['customStyles'];
  };
}

export interface Baseline {
  id: string;
  name: string;
  createdAt: Date;
  tasks: Task[];
}

export interface HistoryEntry {
    actionType: string;
    timestamp: Date;
    payloadDescription?: string;
}

export type Representation = 'gantt' | 'kanban' | 'resource-usage';

export interface ProjectState {
    tasks: Task[];
    links: Link[];
    resources: Resource[];
    assignments: Assignment[];
    zones: Zone[];
    calendars: Calendar[];
    defaultCalendarId: string | null;
    baselines: Baseline[];
    
    // Selection state
  projectColors: Record<string, string>;
  projectTextColors: Record<string, string>;
  projectCriticalPathColors: Record<string, string>;

    selectionMode: SelectionMode;
    selectedTaskIds: string[];
    selectionAnchor: string | null; // A taskId for row selection anchor
    focusCell: { taskId: string, columnId: string } | null;
    anchorCell: { taskId: string, columnId: string } | null; // For cell selection anchor
    
    editingCell?: { taskId: string, columnId: string, initialValue?: string } | null;
    
    // UI and View settings
    visibleColumns: string[];
    columns: ColumnSpec[];
    sortColumn?: string | null;
    sortDirection?: 'asc' | 'desc' | null;
    uiDensity: UiDensity;
    grouping: string[];
    groupingState: { mode: 'expanded' | 'collapsed'; overrides: string[] };
    filters: Filter[];
    views: View[];
    currentViewId: string | null;
    isDirty?: boolean;
    multiSelectMode: boolean;

    ganttSettings: GanttSettings;
    stylePresets: StylePreset[];
    activeStylePresetId: string | null;
    notifications: { id: string; type: 'toast'; title: string; description: string }[];
    currentRepresentation: Representation;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: any;
  memberIds: string[];
  subprojectIds?: string[];
  initials?: string;
  color?: string;
  textColor?: string;
  criticalPathColor?: string;

  // Metrics & Metadata
  taskCount?: number;
  startDate?: any;
  finishDate?: any;
  duration?: number;
  lastModified?: any;
  lastModifiedBy?: string;
  status?: string;
  linkedProjectIds?: string[];
}

export interface ProjectMember {
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  displayName: string;
  photoURL: string;
  permissions?: {
    hiddenColumns?: string[];
  };
}

export interface AppUser {
    id: string;
    projectIds: string[];
}

export interface Invitation {
  id: string;
  email: string;
  projectId: string;
  role: 'editor' | 'viewer';
  invitedBy: string;
}

export type GroupRow = {
    itemType: 'group';
    id: string;
    level: number;
    name: string;
    childCount: number;
    isCollapsed: boolean;
};

export type TaskRow = {
    itemType: 'task';
    data: Task;
    displayLevel: number;
};

export type RenderableRow = GroupRow | TaskRow;
