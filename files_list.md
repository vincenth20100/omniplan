# Required Files List

The following files are required to generate the display shown in the OmniPlan AI image:

## Core Page & Layout
- **`src/app/[projectId]/page.tsx`**: The main entry point for the project page.
- **`src/components/project-page.tsx`**: The top-level component managing the project view, state, and layout.
- **`src/components/layout/main-layout.tsx`**: The structural layout wrapper for the application.

## Sidebar Navigation
- **`src/components/layout/sidebar/project-sidebar.tsx`**: The sidebar container.
- **`src/components/layout/sidebar/dynamic-sidebar-navigation.tsx`**: Renders dynamic sidebar buttons (e.g., Add Task, Undo, Redo).
- **`src/lib/default-theme-config.ts`**: Contains the sidebar configuration (`DEFAULT_SIDEBAR_CONFIG`) defining the items.

## Gantt Chart Area (Main Content)
- **`src/components/omni-gantt/gantt-chart.tsx`**: The main Gantt component managing the split pane.
- **`src/components/omni-gantt/task-table.tsx`**: The left pane displaying the task list and hierarchy.
- **`src/components/omni-gantt/timeline.tsx`**: The right pane displaying the timeline and bars.
- **`src/components/omni-gantt/task-bar.tsx`**: Renders individual task bars on the timeline.
- **`src/components/omni-gantt/timeline-header.tsx`**: Renders the time scale header (Years/Months).
- **`src/components/omni-gantt/dependency-lines.tsx`**: Draws the dependency lines between tasks.

## Task Details Panel (Bottom Section)
- **`src/components/details/task-details-panel.tsx`**: The container for the bottom panel showing task details.
- **`src/components/details/task-links-panel.tsx`**: Content for the active "Links" tab.
- **`src/components/details/predecessor-list.tsx`**: Renders the "Predecessors" table.
- **`src/components/details/successor-list.tsx`**: Renders the "Successors" table.
- **`src/components/details/add-relationship-row.tsx`**: Renders the "+ Add new predecessor" input row.
- **`src/components/details/relationship-combobox.tsx`**: Renders the task selection dropdown for relationships.

## State & Data Management
- **`src/hooks/use-project.ts`**: The main hook managing project state (tasks, links, selection).
- **`src/lib/types.ts`**: TypeScript definitions for core data structures (Task, Link, ProjectState).
- **`src/components/theme/theme-context.tsx`**: Manages theme and sidebar configuration.
