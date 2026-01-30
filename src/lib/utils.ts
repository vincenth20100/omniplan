import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const PROJECT_COLORS = [
    '#ef4444', // red-500
    '#ec4899', // pink-500
    '#a855f7', // purple-500
    '#6366f1', // indigo-500
    '#3b82f6', // blue-500
    '#06b6d4', // cyan-500
    '#14b8a6', // teal-500
    '#22c55e', // green-500
    '#84cc16', // lime-500
    '#eab308', // yellow-500
    '#f97316', // orange-500
];

export function getProjectColor(projectId: string | undefined): string {
    if (!projectId) return '#ef4444'; // default critical color
    let hash = 0;
    for (let i = 0; i < projectId.length; i++) {
        hash = projectId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % PROJECT_COLORS.length;
    return PROJECT_COLORS[index];
}
