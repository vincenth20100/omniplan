'use client';

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
import { useIsMobile } from '@/hooks/use-mobile';
import { GanttChartSquare, LogOut } from 'lucide-react';
import React from 'react';
import { useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { User } from 'firebase/auth';
import { useThemeContext } from '@/components/theme/theme-context';
import { cn } from '@/lib/utils';

const AppHeader = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <header className={cn("flex h-14 items-center gap-4 border-b bg-background/95 px-4 lg:h-[60px] lg:px-6 backdrop-blur-sm sticky top-0 z-[35]", className)}>
    {children}
  </header>
);

const UserMenu = ({ user }: { user: User }) => {
    const auth = useAuth();
    const handleSignOut = () => {
        signOut(auth);
    }
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                 <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'User'} />
                        <AvatarFallback>{user.displayName?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.displayName}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

interface MainLayoutProps {
  children: React.ReactNode;
  sidebarContent: React.ReactNode;
  headerLeftActions?: React.ReactNode;
  headerRightActions?: React.ReactNode;
  user: User;
}

function MainLayoutContent({ children, sidebarContent, headerLeftActions, headerRightActions, user }: MainLayoutProps) {
  const isMobile = useIsMobile();
  const { layoutConfig } = useThemeContext();
  const { sidebarPosition } = layoutConfig;
  const isHorizontal = sidebarPosition === 'top' || sidebarPosition === 'bottom';
  const isRight = sidebarPosition === 'right';

  if (isHorizontal) {
     return (
        <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
            {/* Top Bar */}
            {sidebarPosition === 'top' && (
                <div className="border-b p-2 flex overflow-x-auto bg-sidebar text-sidebar-foreground shrink-0 items-center min-h-[50px]">
                   <div className="flex items-center gap-2 mr-4 shrink-0">
                        <GanttChartSquare className="h-6 w-6 text-primary" />
                        <h2 className="text-lg font-semibold font-headline truncate">OmniPlan AI</h2>
                   </div>
                   <div className="flex-1 overflow-x-auto">
                        {sidebarContent}
                   </div>
                </div>
            )}

            {/* Header and Content */}
             <div className="flex-1 flex flex-col min-h-0 relative">
                <AppHeader>
                  {headerLeftActions}
                  {!isMobile && <h1 className="text-xl font-semibold font-headline">Project Plan</h1>}
                   <div className="ml-auto flex items-center gap-4">
                      {headerRightActions}
                      {user && <UserMenu user={user} />}
                  </div>
                </AppHeader>
                <div className="flex-1 p-4 md:p-6 overflow-auto">
                    {children}
                </div>
             </div>

             {/* Bottom Bar */}
             {sidebarPosition === 'bottom' && (
                <div className="border-t p-2 flex overflow-x-auto bg-sidebar text-sidebar-foreground shrink-0 items-center min-h-[50px]">
                    <div className="flex items-center gap-2 mr-4 shrink-0">
                        <GanttChartSquare className="h-6 w-6 text-primary" />
                        <h2 className="text-lg font-semibold font-headline truncate">OmniPlan AI</h2>
                   </div>
                   <div className="flex-1 overflow-x-auto">
                       {sidebarContent}
                   </div>
                </div>
             )}
        </div>
     );
  }

  return (
    <>
      <Sidebar collapsible="icon" side={isRight ? 'right' : 'left'}>
        <SidebarHeader>
          <div className="flex items-center gap-2 p-2 group-data-[collapsible=icon]:justify-center">
            <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
              <GanttChartSquare className="h-6 w-6 text-primary" />
            </Button>
            <div className='overflow-hidden group-data-[collapsible=icon]:hidden'>
               <h2 className="text-lg font-semibold font-headline truncate">OmniPlan AI</h2>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          {sidebarContent}
        </SidebarContent>
        <SidebarFooter>
          <SidebarTrigger />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <AppHeader>
          {!isMobile && <SidebarTrigger />}
          {headerLeftActions}
          {!isMobile && <h1 className="text-xl font-semibold font-headline">Project Plan</h1>}
           <div className="ml-auto flex items-center gap-4">
              {headerRightActions}
              {user && <UserMenu user={user} />}
          </div>
        </AppHeader>
        <div className="flex-1 p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
    </>
  );
}

export function MainLayout(props: MainLayoutProps) {
    return (
        <SidebarProvider>
            <MainLayoutContent {...props} />
        </SidebarProvider>
    );
}
