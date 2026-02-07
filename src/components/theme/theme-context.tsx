'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { SidebarConfig, LayoutConfig, ElementStyleConfig } from '@/lib/theme-types';
import { DEFAULT_SIDEBAR_CONFIG } from '@/lib/default-theme-config';

interface ThemeContextType {
  sidebarConfig: SidebarConfig;
  setSidebarConfig: (config: SidebarConfig) => void;
  layoutConfig: LayoutConfig;
  setLayoutConfig: (config: LayoutConfig) => void;
  elementStyles: ElementStyleConfig;
  setElementStyles: (styles: ElementStyleConfig) => void;
  isCustomizing: boolean;
  setIsCustomizing: (isCustomizing: boolean) => void;
  updateElementStyle: (elementId: string, style: React.CSSProperties) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [sidebarConfig, setSidebarConfig] = useState<SidebarConfig>(DEFAULT_SIDEBAR_CONFIG);
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>({
    sidebarPosition: 'left',
    enableMacOsHover: false,
  });
  const [elementStyles, setElementStyles] = useState<ElementStyleConfig>({});
  const [isCustomizing, setIsCustomizing] = useState(false);

  const updateElementStyle = (elementId: string, style: React.CSSProperties) => {
    setElementStyles((prev) => ({
      ...prev,
      [elementId]: { ...prev[elementId], ...style },
    }));
  };

  return (
    <ThemeContext.Provider
      value={{
        sidebarConfig,
        setSidebarConfig,
        layoutConfig,
        setLayoutConfig,
        elementStyles,
        setElementStyles,
        isCustomizing,
        setIsCustomizing,
        updateElementStyle,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}
