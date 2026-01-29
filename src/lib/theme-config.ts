
import type { StylePreset } from "./types";

export interface ThemeVariableConfig {
    key: string;
    label: string;
    category: 'Global' | 'Sidebar' | 'Gantt' | 'Layout';
    type: 'color-hsl' | 'color-css' | 'size';
    description?: string;
}

export const THEME_VARIABLES: ThemeVariableConfig[] = [
    // Global Colors
    { key: '--background', label: 'Background', category: 'Global', type: 'color-hsl' },
    { key: '--foreground', label: 'Foreground', category: 'Global', type: 'color-hsl' },
    { key: '--card', label: 'Card Background', category: 'Global', type: 'color-hsl' },
    { key: '--card-foreground', label: 'Card Foreground', category: 'Global', type: 'color-hsl' },
    { key: '--popover', label: 'Popover Background', category: 'Global', type: 'color-hsl' },
    { key: '--popover-foreground', label: 'Popover Foreground', category: 'Global', type: 'color-hsl' },
    { key: '--primary', label: 'Primary', category: 'Global', type: 'color-hsl' },
    { key: '--primary-foreground', label: 'Primary Foreground', category: 'Global', type: 'color-hsl' },
    { key: '--secondary', label: 'Secondary', category: 'Global', type: 'color-hsl' },
    { key: '--secondary-foreground', label: 'Secondary Foreground', category: 'Global', type: 'color-hsl' },
    { key: '--muted', label: 'Muted', category: 'Global', type: 'color-hsl' },
    { key: '--muted-foreground', label: 'Muted Foreground', category: 'Global', type: 'color-hsl' },
    { key: '--accent', label: 'Accent', category: 'Global', type: 'color-hsl' },
    { key: '--accent-foreground', label: 'Accent Foreground', category: 'Global', type: 'color-hsl' },
    { key: '--destructive', label: 'Destructive', category: 'Global', type: 'color-hsl' },
    { key: '--destructive-foreground', label: 'Destructive Foreground', category: 'Global', type: 'color-hsl' },
    { key: '--border', label: 'Border', category: 'Global', type: 'color-hsl' },
    { key: '--input', label: 'Input', category: 'Global', type: 'color-hsl' },
    { key: '--ring', label: 'Ring', category: 'Global', type: 'color-hsl' },

    // Sidebar
    { key: '--sidebar-background', label: 'Sidebar Background', category: 'Sidebar', type: 'color-hsl' },
    { key: '--sidebar-foreground', label: 'Sidebar Foreground', category: 'Sidebar', type: 'color-hsl' },
    { key: '--sidebar-primary', label: 'Sidebar Primary', category: 'Sidebar', type: 'color-hsl' },
    { key: '--sidebar-primary-foreground', label: 'Sidebar Primary Foreground', category: 'Sidebar', type: 'color-hsl' },
    { key: '--sidebar-accent', label: 'Sidebar Accent', category: 'Sidebar', type: 'color-hsl' },
    { key: '--sidebar-accent-foreground', label: 'Sidebar Accent Foreground', category: 'Sidebar', type: 'color-hsl' },
    { key: '--sidebar-border', label: 'Sidebar Border', category: 'Sidebar', type: 'color-hsl' },
    { key: '--sidebar-ring', label: 'Sidebar Ring', category: 'Sidebar', type: 'color-hsl' },

    // Gantt
    { key: '--gantt-bar-default', label: 'Gantt Bar (Default)', category: 'Gantt', type: 'color-hsl' },
    { key: '--gantt-bar-critical', label: 'Gantt Bar (Critical)', category: 'Gantt', type: 'color-hsl' },
    { key: '--milestone-default', label: 'Milestone (Default)', category: 'Gantt', type: 'color-hsl' },
    { key: '--milestone-critical', label: 'Milestone (Critical)', category: 'Gantt', type: 'color-hsl' },
    { key: '--task-row-level-0-bg', label: 'Task Row (Level 0)', category: 'Gantt', type: 'color-css' },
    { key: '--task-row-level-1-bg', label: 'Task Row (Level 1)', category: 'Gantt', type: 'color-css' },
    { key: '--task-row-level-2-plus-bg', label: 'Task Row (Level 2+)', category: 'Gantt', type: 'color-css' },

    // Layout
    { key: '--radius', label: 'Radius', category: 'Layout', type: 'size' },
];

export const THEME_PRESETS: StylePreset[] = [
    {
        id: 'default-dark',
        name: 'Default Dark',
        isDefault: true,
        settings: {
            theme: 'dark',
            customStyles: {}
        }
    },
    {
        id: 'default-light',
        name: 'Default Light',
        isDefault: true,
        settings: {
            theme: 'light',
            customStyles: {}
        }
    },
    {
        id: 'default-sepia',
        name: 'Default Sepia',
        isDefault: true,
        settings: {
            theme: 'sepia',
            customStyles: {
                '--accent': '35 78% 85%', // Lighter accent for better selection visibility
                '--accent-foreground': '39 21% 15%',
                '--gantt-bar-default': '35 78% 45%', // Match primary
            }
        }
    },
    {
        id: 'modern-dark',
        name: 'Modern Dark',
        isDefault: true,
        settings: {
            theme: 'dark',
            customStyles: {
                '--background': '222 47% 11%',
                '--foreground': '210 40% 98%',
                '--card': '217 33% 17%',
                '--card-foreground': '210 40% 98%',
                '--popover': '222 47% 11%',
                '--popover-foreground': '210 40% 98%',
                '--primary': '199 89% 48%',
                '--primary-foreground': '222 47.4% 11.2%',
                '--secondary': '217 33% 17%',
                '--secondary-foreground': '210 40% 98%',
                '--muted': '217 33% 17%',
                '--muted-foreground': '215 20.2% 65.1%',
                '--accent': '217 33% 17%',
                '--accent-foreground': '210 40% 98%',
                '--destructive': '0 62.8% 30.6%',
                '--destructive-foreground': '210 40% 98%',
                '--border': '217 33% 17%',
                '--input': '217 33% 17%',
                '--ring': '199 89% 48%',
                '--radius': '0.75rem',
                '--sidebar-background': '222 47% 11%',
                '--sidebar-foreground': '210 40% 98%',
                '--sidebar-primary': '199 89% 48%',
                '--sidebar-primary-foreground': '222 47.4% 11.2%',
                '--sidebar-accent': '217 33% 17%',
                '--sidebar-accent-foreground': '210 40% 98%',
                '--sidebar-border': '217 33% 17%',
                '--sidebar-ring': '199 89% 48%',
                '--gantt-bar-default': '199 89% 48%',
            }
        }
    },
    {
        id: 'pastels',
        name: 'Pastels',
        isDefault: true,
        settings: {
            theme: 'light',
            customStyles: {
                '--background': '60 30% 96%',
                '--foreground': '20 14% 4%',
                '--card': '0 0% 100%',
                '--card-foreground': '20 14% 4%',
                '--popover': '0 0% 100%',
                '--popover-foreground': '20 14% 4%',
                '--primary': '350 100% 88%', // Pastel Pink
                '--primary-foreground': '350 100% 20%',
                '--secondary': '150 50% 90%', // Pastel Green
                '--secondary-foreground': '150 50% 20%',
                '--muted': '60 30% 90%',
                '--muted-foreground': '25 5% 45%',
                '--accent': '350 100% 94%',
                '--accent-foreground': '20 14% 4%',
                '--destructive': '0 84.2% 60.2%',
                '--destructive-foreground': '0 0% 98%',
                '--border': '20 5% 90%',
                '--input': '20 5% 90%',
                '--ring': '350 100% 88%',
                '--radius': '1rem',
                '--gantt-bar-default': '350 100% 80%',
                '--milestone-default': '350 100% 80%',
            }
        }
    },
    {
        id: 'windows-11',
        name: 'Windows 11',
        isDefault: true,
        settings: {
            theme: 'light',
            customStyles: {
                '--background': '0 0% 96%', // #f3f3f3
                '--foreground': '0 0% 0%',
                '--card': '0 0% 100%',
                '--card-foreground': '0 0% 0%',
                '--popover': '0 0% 100%',
                '--popover-foreground': '0 0% 0%',
                '--primary': '206 100% 42%', // #0078D4
                '--primary-foreground': '0 0% 100%',
                '--secondary': '0 0% 96%',
                '--secondary-foreground': '0 0% 0%',
                '--muted': '0 0% 96%',
                '--muted-foreground': '0 0% 45%',
                '--accent': '0 0% 96%',
                '--accent-foreground': '0 0% 0%',
                '--destructive': '0 72% 51%',
                '--destructive-foreground': '0 0% 100%',
                '--border': '0 0% 90%',
                '--input': '0 0% 100%',
                '--ring': '206 100% 42%',
                '--radius': '0.5rem',
                '--sidebar-background': '0 0% 93%', // darker gray
                '--sidebar-foreground': '0 0% 0%',
                '--sidebar-primary': '206 100% 42%',
                '--sidebar-primary-foreground': '0 0% 100%',
                '--sidebar-accent': '0 0% 90%',
                '--sidebar-accent-foreground': '0 0% 0%',
                '--sidebar-border': '0 0% 90%',
                '--sidebar-ring': '206 100% 42%',
                '--gantt-bar-default': '206 100% 42%',
            }
        }
    },
    {
        id: 'macos',
        name: 'MacOS',
        isDefault: true,
        settings: {
            theme: 'light',
            customStyles: {
                '--background': '240 5% 96%', // #F5F5F7
                '--foreground': '0 0% 0%',
                '--card': '0 0% 100%',
                '--card-foreground': '0 0% 0%',
                '--popover': '0 0% 100%',
                '--popover-foreground': '0 0% 0%',
                '--primary': '211 100% 50%', // #007AFF
                '--primary-foreground': '0 0% 100%',
                '--secondary': '240 5% 96%',
                '--secondary-foreground': '0 0% 0%',
                '--muted': '240 5% 96%',
                '--muted-foreground': '240 4% 46%',
                '--accent': '211 100% 95%',
                '--accent-foreground': '211 100% 50%',
                '--destructive': '0 84% 60%',
                '--destructive-foreground': '0 0% 100%',
                '--border': '240 6% 90%',
                '--input': '240 6% 90%',
                '--ring': '211 100% 50%',
                '--radius': '0.75rem',
                '--sidebar-background': '240 5% 93%', // slightly darker
                '--sidebar-foreground': '0 0% 0%',
                '--sidebar-primary': '211 100% 50%',
                '--sidebar-primary-foreground': '0 0% 100%',
                '--sidebar-accent': '240 5% 90%',
                '--sidebar-accent-foreground': '0 0% 0%',
                '--sidebar-border': '240 6% 85%',
                '--sidebar-ring': '211 100% 50%',
                '--gantt-bar-default': '211 100% 50%',
            }
        }
    }
];
