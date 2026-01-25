export type LinkType = "FS" | "SS" | "FF" | "SF";

export type ConstraintType = "Start No Earlier Than" | "Must Start On";

export interface Task {
  id: string;
  name: string;
  start: Date;
  finish: Date;
  duration: number; // in working days
  percentComplete: number;
  
  constraintType?: ConstraintType | null;
  constraintDate?: Date | null;
  zoneId?: string | null;
  customAttributes?: Record<string, any> | null;

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

export interface ProjectState {
    tasks: Task[];
    links: Link[];
    zones: Zone[];
    historyLog: any[];
    selectedTaskId: string | null;
}
