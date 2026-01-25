# **App Name**: OmniPlan AI

## Core Features:

- Task Data Structure: Defines the Task interface with fields for id, name, duration, start, finish, percentComplete, constraintType, constraintDate, zoneId, and customAttributes.
- Critical Path Calculation: Calculates the critical path based on finish-to-start dependencies.
- Calendar Service: Manages date additions based on a standard Mon-Fri, 08:00-17:00 calendar.
- Gantt Chart UI: Displays a split view with a task table on the left and a timeline bar chart on the right. Allows dragging tasks to move or resize them.
- Dependency Engine: Implements logic for SS, FF, SF links, lag, and driving predecessor calculations, flagging driving links where free slack is zero.
- Constraint Handling: Applies logic for start no earlier than and must start on constraints; identifies scheduling conflicts.
- Spatial Map Integration: Displays tasks on a 4D map using react-leaflet or fabric.js, linking them to spatial zones based on task timing.
- PDF Export: Generates a PDF layout by creating viewport slices of the Gantt chart timeline.
- Conflict Identification Tool: An LLM tool which identifies scheduling conflicts.  This tool identifies links where constraints are not met because a logic link pushes a task past a "Must Start On" date. A human is expected to review the decision.

## Style Guidelines:

- Primary color: Deep teal (#008080) for a professional and trustworthy feel, inspired by project management visuals.
- Background color: Light teal (#E0F8F8) – a muted version of the primary color to ensure readability and a calm visual base.
- Accent color: Gold (#D4AF37) – an analogous color providing a noticeable contrast to highlight critical elements.
- Font pairing: 'Space Grotesk' (sans-serif) for headlines, and 'Inter' (sans-serif) for body text to combine modernity with legibility. The chosen pairing improves clarity and ease of reading in both titles and longer text sections.
- Code font: 'Source Code Pro' for displaying code snippets.
- Consistent, professional icons representing various task types, statuses, and dependencies.
- Clean, organized layout emphasizing the Gantt chart and task details with logical grouping of controls and information.
- Subtle transitions when updating task statuses or dependencies for clear feedback without being distracting.