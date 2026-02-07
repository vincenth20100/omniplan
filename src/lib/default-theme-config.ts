import { SidebarConfig } from './theme-types';

export const DEFAULT_SIDEBAR_CONFIG: SidebarConfig = [
    {
        id: 'group-edit',
        type: 'group',
        label: 'Edit',
        showLabel: true,
        items: [
            { id: 'add-task', type: 'item', label: 'Add Task', icon: 'Plus', action: 'dispatch:ADD_TASK', params: { generateId: true } },
            { id: 'undo', type: 'item', label: 'Undo', icon: 'Undo2', action: 'dispatch:UNDO' },
            { id: 'redo', type: 'item', label: 'Redo', icon: 'Redo2', action: 'dispatch:REDO' },
            { id: 'delete', type: 'item', label: 'Delete', icon: 'Trash2', action: 'dispatch:REMOVE_TASK' },
            { id: 'indent', type: 'item', label: 'Indent', icon: 'Indent', action: 'dispatch:INDENT_TASK' },
            { id: 'outdent', type: 'item', label: 'Outdent', icon: 'Outdent', action: 'dispatch:OUTDENT_TASK' },
        ]
    },
    {
        id: 'group-data',
        type: 'group',
        label: 'Data',
        showLabel: true,
        items: [
            { id: 'resources', type: 'item', label: 'Resources', icon: 'Users', action: 'navigate:resources' },
            { id: 'calendars', type: 'item', label: 'Calendars', icon: 'CalendarDays', action: 'navigate:calendars' },
            { id: 'subprojects', type: 'item', label: 'Subprojects', icon: 'FolderTree', action: 'navigate:subprojects' },
        ]
    },
    {
        id: 'group-view',
        type: 'group',
        label: 'View',
        showLabel: true,
        items: [
            { id: 'columns', type: 'item', label: 'Columns', icon: 'Columns3', action: 'navigate:columns' },
            { id: 'filters', type: 'item', label: 'Filters', icon: 'Filter', action: 'navigate:filters' },
            { id: 'grouping', type: 'item', label: 'Grouping', icon: 'FolderTree', action: 'navigate:grouping' },
            { id: 'collapse-all', type: 'item', label: 'Collapse All', icon: 'ChevronsUp', action: 'dispatch:COLLAPSE_ALL' },
            { id: 'expand-all', type: 'item', label: 'Expand All', icon: 'ChevronsDown', action: 'dispatch:EXPAND_ALL' },
            { id: 'display-options', type: 'item', label: 'Display Options', icon: 'Settings', action: 'navigate:gantt-settings' },
            { id: 'manage-views', type: 'item', label: 'Manage Views', icon: 'Layers', action: 'navigate:manage-views' },
        ]
    },
    {
        id: 'group-tools',
        type: 'group',
        label: 'Tools',
        showLabel: true,
        items: [
            { id: 'history', type: 'item', label: 'History', icon: 'History', action: 'navigate:history' },
            { id: 'shortcuts', type: 'item', label: 'Shortcuts', icon: 'Keyboard', action: 'navigate:shortcuts' },
            { id: 'find-replace', type: 'item', label: 'Find & Replace', icon: 'Search', action: 'navigate:find-replace' },
            { id: 'print-preview', type: 'item', label: 'Print Preview', icon: 'Printer', action: 'navigate:print' },
        ]
    }
];
