import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { GanttChartSquare } from 'lucide-react';
import React from 'react';

const AppHeader = ({ children }: { children: React.ReactNode }) => (
  <header className="flex h-14 items-center gap-4 border-b bg-background/95 px-4 lg:h-[60px] lg:px-6 backdrop-blur-sm sticky top-0 z-30">
    {children}
  </header>
);

export function MainLayout({ children, sidebarContent, headerLeftActions, headerRightActions }: { children: React.ReactNode, sidebarContent: React.ReactNode, headerLeftActions?: React.ReactNode, headerRightActions?: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 p-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
              <GanttChartSquare className="h-6 w-6 text-primary" />
            </Button>
            <div className='overflow-hidden'>
               <h2 className="text-lg font-semibold font-headline truncate">OmniPlan AI</h2>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          {sidebarContent}
        </SidebarContent>
        <SidebarFooter>
          {/* Footer content if any */}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <AppHeader>
          <SidebarTrigger />
          {headerLeftActions}
          <h1 className="text-xl font-semibold font-headline">Project Plan</h1>
           <div className="ml-auto flex items-center gap-2">
              {headerRightActions}
          </div>
        </AppHeader>
        <div className="flex-1 p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
