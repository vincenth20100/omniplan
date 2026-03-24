'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { AppUser } from '@/types/auth';
import type { Project } from '@/lib/types';
import { ALL_COLUMNS } from '@/lib/columns';
import { useAuth } from '@/providers/auth-provider';
import { projectApi } from '@/services/project-api';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, LogOut, Users } from 'lucide-react';
import { ProjectSettingsDialog } from './project-settings-dialog';
import { ProjectList, type ProjectWithMetadata } from './project-list';
import { UserAdminDialog } from '@/components/admin/user-admin-dialog';
import { ImportDialog } from './import-dialog';
import { ImportedProjectData } from '@/lib/import-utils';
import { Upload } from 'lucide-react';
import { useIsAdmin } from '@/hooks/use-is-admin';

export function ProjectSelectionPage({ user }: { user: AppUser }) {
    const { logout } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [projects, setProjects] = useState<ProjectWithMetadata[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isCloning] = useState<string | null>(null);
    const [projectToDelete, setProjectToDelete] = useState<ProjectWithMetadata | null>(null);
    const { isAdmin, isLoading: isCheckingAdmin } = useIsAdmin(user);
    const [isUserAdminOpen, setIsUserAdminOpen] = useState(false);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<ProjectWithMetadata | null>(null);

    // Load projects from API on mount
    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        projectApi.listProjects()
            .then((rows) => {
                if (cancelled) return;
                setProjects(rows as ProjectWithMetadata[]);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('Failed to load projects:', err);
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to load projects.' });
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => { cancelled = true; };
    }, [toast]);

    const handleSignOut = () => {
        logout();
    }

    const handleOpenSettings = (project: ProjectWithMetadata) => {
        setSelectedProject(project);
        setIsSettingsOpen(true);
    };

    const handleArchiveProject = async (project: ProjectWithMetadata) => {
        try {
            await projectApi.updateProject(project.id, { status: 'archived' });
            setProjects(prev => prev.filter(p => p.id !== project.id));
            toast({ title: 'Project archived', description: `"${project.name}" has been archived.` });
        } catch (err) {
            console.error('Failed to archive project:', err);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to archive project.' });
        }
    }

    const handleCreateProject = async () => {
        setIsCreating(true);
        try {
            const name = `New Project ${new Date().toLocaleDateString()}`;
            const created = await projectApi.createProject({ name });
            setProjects(prev => [...prev, created as ProjectWithMetadata]);
            router.push(`/${created.id}`);
        } catch (err) {
            console.error('Failed to create project:', err);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to create project.' });
        } finally {
            setIsCreating(false);
        }
    };

    const handleImportProject = async (_data: ImportedProjectData) => {
        // TODO(T5): implement full import via API
        setIsImporting(true);
        toast({ variant: "destructive", title: "Not implemented", description: "Import not yet available." });
        setIsImporting(false);
    };

    const handleCloneProject = async (_sourceProjectId: string) => {
        // TODO(T5): implement clone via API
        toast({ variant: "destructive", title: "Not implemented", description: "Clone not yet available." });
    }

    const handleDeleteProject = async () => {
        if (!projectToDelete) return;
        try {
            await projectApi.deleteProject(projectToDelete.id);
            setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
            toast({ title: 'Project deleted', description: `"${projectToDelete.name}" has been deleted.` });
        } catch (err) {
            console.error('Failed to delete project:', err);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete project.' });
        } finally {
            setProjectToDelete(null);
        }
    }

    if (isLoading || isCheckingAdmin) {
        return (
            <div className="flex items-center justify-center h-screen bg-background">
                <p>Loading projects...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">{isAdmin ? 'All Projects' : 'Your Projects'}</h1>
                <div className="flex items-center gap-4">
                    {isAdmin && (
                        <Button variant="outline" onClick={() => setIsUserAdminOpen(true)}>
                            <Users className="mr-2 h-4 w-4" />
                            User Admin
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => setIsImportOpen(true)} disabled={isImporting || isCreating}>
                         {isImporting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Upload className="mr-2 h-4 w-4" />
                        )}
                        Import Project
                    </Button>
                    <Button onClick={handleCreateProject} disabled={isCreating || isImporting}>
                        {isCreating ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Plus className="mr-2 h-4 w-4" />
                        )}
                        Create New Project
                    </Button>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={user.avatarUrl || undefined} alt={user.name || 'User'} />
                                    <AvatarFallback>{user.name?.charAt(0) || 'U'}</AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end" forceMount>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">{user.name}</p>
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
                </div>
            </header>

            <ProjectList
                projects={projects}
                user={user}
                isAdmin={isAdmin}
                isCloning={isCloning}
                onOpen={(id) => router.push(`/${id}`)}
                onClone={handleCloneProject}
                onArchive={handleArchiveProject}
                onSettings={handleOpenSettings}
                onDelete={setProjectToDelete}
            />

            <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the project "{projectToDelete?.name}" and all of its data. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {selectedProject && (
                <ProjectSettingsDialog
                    open={isSettingsOpen}
                    onOpenChange={setIsSettingsOpen}
                    project={selectedProject}
                    allColumns={ALL_COLUMNS}
                    onProjectUpdate={(updatedProject) => {
                        setProjects(projects.map(p => p.id === updatedProject.id ? { ...p, ...updatedProject } : p));
                    }}
                />
            )}

            <UserAdminDialog open={isUserAdminOpen} onOpenChange={setIsUserAdminOpen} />
            <ImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} onImport={handleImportProject} />
        </div>
    );
}
