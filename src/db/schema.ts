import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  real,
  boolean,
  jsonb,
  pgEnum,
  index,
  foreignKey,
  primaryKey,
  customType,
} from 'drizzle-orm/pg-core';

// pgvector custom type — vector(1536) for AI embeddings
const vector = customType<{ data: number[]; driverData: string; config: { dimensions: number } }>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .split(',')
      .map(Number);
  },
});

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const projectStatusEnum = pgEnum('project_status', ['active', 'archived', 'template']);
export const memberRoleEnum = pgEnum('member_role', ['owner', 'editor', 'viewer']);
export const linkTypeEnum = pgEnum('link_type', ['FS', 'SS', 'FF', 'SF']);

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: text('owner_id').notNull(), // PocketBase user ID
  name: text('name').notNull(),
  description: text('description'),
  status: projectStatusEnum('status').default('active').notNull(),
  settings: jsonb('settings').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Project Members — composite PK (project_id, user_id)
// ---------------------------------------------------------------------------
export const projectMembers = pgTable(
  'project_members',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(), // PocketBase user ID
    role: memberRoleEnum('role').notNull(),
    displayName: text('display_name'),
    photoUrl: text('photo_url'),
    permissions: jsonb('permissions'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.projectId, table.userId] }),
    projectIdx: index('project_members_project_idx').on(table.projectId),
    userIdx: index('project_members_user_idx').on(table.userId),
  }),
);

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    // Self-referential FK added via foreignKey() in the third argument
    parentId: uuid('parent_id'),
    name: text('name').notNull(),
    startDate: timestamp('start_date'),
    finishDate: timestamp('finish_date'),
    duration: real('duration'), // in the unit specified by duration_unit
    durationUnit: text('duration_unit'), // 'd' | 'm' | 'ed' | 'em'
    work: real('work'), // total labor hours
    schedulingType: text('scheduling_type'), // 'duration' | 'effort'
    constraintType: text('constraint_type'),
    constraintDate: timestamp('constraint_date'),
    deadline: timestamp('deadline'),
    percentComplete: integer('percent_complete').default(0),
    status: text('status'),
    isMilestone: boolean('is_milestone').default(false),
    isSummary: boolean('is_summary').default(false),
    isCollapsed: boolean('is_collapsed').default(false),
    isOnCriticalPath: boolean('is_on_critical_path').default(false),
    totalFloat: real('total_float'),
    freeFloat: real('free_float'),
    wbs: text('wbs'),
    outlineLevel: integer('outline_level').default(0),
    calendarId: uuid('calendar_id'), // FK to calendars — added via foreignKey()
    notes: text('notes'),
    customFields: jsonb('custom_fields').default({}).notNull(),
    order: integer('order'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    // pgvector — populated when AI embedding is enabled; nullable
    embedding: vector('embedding', { dimensions: 1536 }),
  },
  (table) => ({
    projectIdx: index('tasks_project_idx').on(table.projectId),
    parentIdx: index('tasks_parent_idx').on(table.parentId),
    // Self-referential FK: parent_id → tasks.id  (set null on parent delete)
    selfRef: foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
    }).onDelete('set null'),
  }),
);

// ---------------------------------------------------------------------------
// Links (task dependencies)
// ---------------------------------------------------------------------------
export const links = pgTable(
  'links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    sourceTaskId: uuid('source_task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    targetTaskId: uuid('target_task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    linkType: linkTypeEnum('link_type').default('FS').notNull(),
    lag: real('lag').default(0),
    lagUnit: text('lag_unit').default('days'),
    // Cross-project link support
    sourceProjectId: uuid('source_project_id').references(() => projects.id, { onDelete: 'cascade' }),
    targetProjectId: uuid('target_project_id').references(() => projects.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    projectIdx: index('links_project_idx').on(table.projectId),
    sourceIdx: index('links_source_idx').on(table.sourceTaskId),
    targetIdx: index('links_target_idx').on(table.targetTaskId),
  }),
);

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------
export const resources = pgTable(
  'resources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    initials: text('initials'),
    type: text('type').default('Work').notNull(), // 'Work' | 'Material' | 'Cost'
    category: text('category'),
    maxUnits: real('max_units').default(1),
    costPerHour: real('cost_per_hour').default(0),
    availability: real('availability').default(1),
    email: text('email'),
    calendarId: uuid('calendar_id'),
    order: integer('order'),
  },
  (table) => ({
    projectIdx: index('resources_project_idx').on(table.projectId),
  }),
);

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------
export const assignments = pgTable('assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  resourceId: uuid('resource_id')
    .notNull()
    .references(() => resources.id, { onDelete: 'cascade' }),
  units: real('units').default(1), // e.g. 1.0 = 100%
  work: real('work'),
});

// ---------------------------------------------------------------------------
// Calendars
// ---------------------------------------------------------------------------
export const calendars = pgTable(
  'calendars',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // Stores { workingDays, exceptions, nonWorkingDayOverrides, workingDayOverrides }
    definition: jsonb('definition').notNull(),
  },
  (table) => ({
    projectIdx: index('calendars_project_idx').on(table.projectId),
  }),
);

// ---------------------------------------------------------------------------
// Baselines
// ---------------------------------------------------------------------------
export const baselines = pgTable(
  'baselines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // JSON snapshot of tasks[] at the time the baseline was set
    snapshot: jsonb('snapshot').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: index('baselines_project_idx').on(table.projectId),
  }),
);

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
export const history = pgTable(
  'history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(), // PocketBase user ID
    action: text('action').notNull(),
    payloadDescription: text('payload_description'),
    diff: jsonb('diff'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    projectTimeIdx: index('history_project_time_idx').on(table.projectId, table.createdAt),
    userIdx: index('history_user_idx').on(table.userId),
  }),
);
