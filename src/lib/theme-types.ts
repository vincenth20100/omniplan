import { CSSProperties } from 'react';

export type SidebarPosition = 'left' | 'right' | 'top' | 'bottom';

export interface SidebarItem {
  id: string;
  type: 'item';
  label: string;
  icon: string; // Lucide icon name
  action: string; // 'navigate:view' or 'dispatch:ACTION'
  params?: any;
  disabled?: boolean;
}

export interface SidebarGroup {
  id: string;
  type: 'group';
  label: string;
  showLabel: boolean;
  items: SidebarItem[];
}

export type SidebarConfig = SidebarGroup[];

export interface LayoutConfig {
  sidebarPosition: SidebarPosition;
  enableMacOsHover: boolean;
}

export interface ElementStyleConfig {
    [elementId: string]: CSSProperties;
}
