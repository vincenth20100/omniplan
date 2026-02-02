'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from 'firebase/auth';
import { useFirestore, useAuth } from '@/firebase';
import { collection, doc, getDoc, getDocs, writeBatch, deleteDoc, updateDoc, arrayRemove, query, arrayUnion } from 'firebase/firestore';
import type { Project } from '@/lib/types';
import { initialTasks, initialLinks, initialResources, initialAssignments, initialCalendars } from '@/lib/mock-data';
import { ALL_COLUMNS } from '@/lib/columns';
import { signOut } from 'firebase/auth';

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
import { Plus, Loader2, LogOut } from 'lucide-react';
import { ProjectSettingsDialog } from './project-settings-dialog';
import { ProjectList, type ProjectWithMetadata } from './project-list';

export function ProjectSelectionPage({ user }: { user: User }) {
    const firestore = useFirestore();
    const auth = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [projects, setProjects] = useState<ProjectWithMetadata[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isCloning, setIsCloning] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [projectToDelete, setProjectToDelete] = useState<ProjectWithMetadata | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<ProjectWithMetadata | null>(null);

    const handleSignOut = () => {
        signOut(auth);
    }

    const handleOpenSettings = (project: ProjectWithMetadata) => {
        setSelectedProject(project);
        setIsSettingsOpen(true);
    };

    const handleArchiveProject = async (project: ProjectWithMetadata) => {
        if (!firestore) return;
        try {
            const newStatus = project.status === 'Archived' ? 'Active' : 'Archived';
            await updateDoc(doc(firestore, 'projects', project.id), { status: newStatus });

            setProjects(prev => prev.map(p => p.id === project.id ? { ...p, status: newStatus } : p));
             toast({
                title: `Project ${newStatus === 'Archived' ? 'Archived' : 'Restored'}`,
                description: `"${project.name}" has been ${newStatus === 'Archived' ? 'archived' : 'restored'}.`,
            });
        } catch (error) {
            console.error("Error updating project status:", error);
             toast({
                variant: "destructive",
                title: "Error",
                description: "Could not update project status."
            });
        }
    }

    useEffect(() => {
        if (user) {
            user.getIdTokenResult().then((idTokenResult) => {
                setIsAdmin(!!idTokenResult.claims.admin);
                setIsCheckingAdmin(false);
            });
        }
    }, [user]);

    useEffect(() => {
        const fetchProjects = async () => {
            if (!firestore || !user || isCheckingAdmin) return;
            setIsLoading(true);

            try {
                let fetchedProjects: ProjectWithMetadata[] = [];

                if (isAdmin) {
                    const projectsQuery = query(collection(firestore, 'projects'));
                    const querySnapshot = await getDocs(projectsQuery);
                    fetchedProjects = querySnapshot.docs.map(snap => {
                         const data = snap.data() as Project;
                         return {
                             ...data,
                             id: snap.id,
                             createdAt: data.createdAt ? (data.createdAt as any).toDate() : new Date(),
                             startDate: data.startDate ? (data.startDate as any).toDate() : undefined,
                             finishDate: data.finishDate ? (data.finishDate as any).toDate() : undefined,
                             lastModified: data.lastModified ? (data.lastModified as any).toDate() : undefined,
                         } as ProjectWithMetadata;
                    });
                } else {
                    const userDocRef = doc(firestore, 'users', user.uid);
                    const userDoc = await getDoc(userDocRef);

                    if (userDoc.exists()) {
                        const projectIds = userDoc.data().projectIds || [];
                        if (projectIds.length > 0) {
                            const projectPromises = projectIds.map((id: string) => getDoc(doc(firestore, 'projects', id)));
                            const projectSnapshots = await Promise.all(projectPromises);
                            fetchedProjects = projectSnapshots
                                .filter(snap => snap.exists())
                                .map(snap => {
                                    const data = snap.data() as Project;
                                    return {
                                        ...data,
                                        id: snap.id,
                                        createdAt: data.createdAt ? (data.createdAt as any).toDate() : new Date(),
                                        startDate: data.startDate ? (data.startDate as any).toDate() : undefined,
                                        finishDate: data.finishDate ? (data.finishDate as any).toDate() : undefined,
                                        lastModified: data.lastModified ? (data.lastModified as any).toDate() : undefined,
                                    } as ProjectWithMetadata;
                                });
                        }
                    }
                }
                setProjects(fetchedProjects.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
            } catch (error) {
                console.error("Error fetching projects:", error);
                toast({
                    variant: "destructive",
                    title: "Error fetching projects",
                    description: "Could not load your projects. Please check your connection and permissions."
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchProjects();
    }, [firestore, user, isAdmin, isCheckingAdmin, toast]);

    const handleCreateProject = async () => {
        if (!firestore) return;
        setIsCreating(true);
        try {
            const newProjectId = `proj-${Date.now()}`;
            const batch = writeBatch(firestore);

            const projectDocRef = doc(firestore, 'projects', newProjectId);
            batch.set(projectDocRef, {
                id: newProjectId,
                name: 'My New Project',
                ownerId: user.uid,
                createdAt: new Date(),
                memberIds: [user.uid],
                initials: 'MN',
                status: 'Active',
                taskCount: initialTasks.length,
                lastModified: new Date(),
            });

            const memberDocRef = doc(firestore, 'projects', newProjectId, 'members', user.uid);
            batch.set(memberDocRef, {
                userId: user.uid,
                role: 'owner',
                displayName: user.displayName || 'User',
                photoURL: user.photoURL || '',
            });

            const userDocRef = doc(firestore, 'users', user.uid);
            batch.set(userDocRef, { id: user.uid, projectIds: arrayUnion(newProjectId) }, { merge: true });
            
            initialTasks.forEach((task, index) => {
                const docRef = doc(firestore, 'projects', newProjectId, 'tasks', task.id);
                batch.set(docRef, { ...task, order: index });
            });
            initialLinks.forEach(link => {
                const docRef = doc(firestore, 'projects', newProjectId, 'links', link.id);
                batch.set(docRef, link);
            });
            initialResources.forEach(resource => {
                const docRef = doc(firestore, 'projects', newProjectId, 'resources', resource.id);
                batch.set(docRef, resource);
            });
            initialAssignments.forEach(assignment => {
                const docRef = doc(firestore, 'projects', newProjectId, 'assignments', assignment.id);
                batch.set(docRef, assignment);
            });
            initialCalendars.forEach(calendar => {
                const docRef = doc(firestore, 'projects', newProjectId, 'calendars', calendar.id);
                batch.set(docRef, calendar);
            });

            await batch.commit();
            router.push(`/${newProjectId}`);
        } catch (error) {
            console.error("Error creating project:", error);
            toast({
                variant: 'destructive',
                title: "Error Creating Project",
                description: "There was an issue creating your new project. Please try again.",
            });
            setIsCreating(false);
        }
    };
    
    const handleCloneProject = async (sourceProjectId: string) => {
        if (!firestore) return;
        setIsCloning(sourceProjectId);

        try {
            const sourceProjectDoc = await getDoc(doc(firestore, 'projects', sourceProjectId));
            if (!sourceProjectDoc.exists()) throw new Error("Source project not found");

            const newProjectId = `proj-${Date.now()}`;
            
            // --- Initial Project and User Setup (First Batch) ---
            const initialBatch = writeBatch(firestore);
            
            // 1. Create the new project document
            const sourceData = sourceProjectDoc.data() as Project;
            initialBatch.set(doc(firestore, 'projects', newProjectId), {
                id: newProjectId,
                name: `${sourceData.name} (Clone)`,
                ownerId: user.uid,
                createdAt: new Date(),
                memberIds: [user.uid],
                initials: sourceData.initials || sourceData.name.substring(0, 2).toUpperCase(),
                status: 'Active',
                taskCount: sourceData.taskCount,
                startDate: sourceData.startDate,
                finishDate: sourceData.finishDate,
                duration: sourceData.duration,
                lastModified: new Date(),
            });

            // 2. Create the owner's member document for the new project
            initialBatch.set(doc(firestore, 'projects', newProjectId, 'members', user.uid), {
                userId: user.uid,
                role: 'owner',
                displayName: user.displayName || 'User',
                photoURL: user.photoURL || '',
            });

            // 3. Add the new project to the user's project list
            initialBatch.update(doc(firestore, 'users', user.uid), { projectIds: arrayUnion(newProjectId) });
            
            await initialBatch.commit();
            
            // --- Batch Copy Subcollections ---
            const subcollections = ['tasks', 'links', 'resources', 'assignments', 'calendars', 'views', 'settings'];
            const allWriteOps: { collectionPath: string, docId: string, data: any }[] = [];

            for (const sub of subcollections) {
                const sourceCol = await getDocs(collection(firestore, 'projects', sourceProjectId, sub));
                sourceCol.forEach(docSnap => {
                    allWriteOps.push({
                        collectionPath: `projects/${newProjectId}/${sub}`,
                        docId: docSnap.id,
                        data: docSnap.data(),
                    });
                });
            }

            const chunkSize = 490; // Firestore batch limit is 500, being safe
            for (let i = 0; i < allWriteOps.length; i += chunkSize) {
                const chunk = allWriteOps.slice(i, i + chunkSize);
                const dataBatch = writeBatch(firestore);
                chunk.forEach(op => {
                    const docRef = doc(firestore, op.collectionPath, op.docId);
                    dataBatch.set(docRef, op.data);
                });
                await dataBatch.commit();
            }

            toast({
                title: "Project Cloned",
                description: "Your project has been successfully cloned.",
            });
            
            const newProjectDoc = await getDoc(doc(firestore, 'projects', newProjectId));
            const newProject = newProjectDoc.data() as Project;
            setProjects(prev => [{
                ...newProject,
                id: newProjectId,
                createdAt: newProject.createdAt ? (newProject.createdAt as any).toDate() : new Date(),
                startDate: newProject.startDate ? (newProject.startDate as any).toDate() : undefined,
                finishDate: newProject.finishDate ? (newProject.finishDate as any).toDate() : undefined,
                lastModified: newProject.lastModified ? (newProject.lastModified as any).toDate() : undefined,
            } as ProjectWithMetadata, ...prev].sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()));

        } catch (error) {
             console.error("Error cloning project:", error);
            toast({
                variant: 'destructive',
                title: "Error Cloning Project",
                description: (error as Error).message || "There was an issue cloning the project.",
            });
        } finally {
            setIsCloning(null);
        }
    }

    const handleDeleteProject = async () => {
        if (!projectToDelete || !firestore) return;
        setIsDeleting(projectToDelete.id);

        try {
            if (projectToDelete.ownerId !== user.uid && !isAdmin) {
                throw new Error("You do not have permission to delete this project.");
            }
            
            await deleteDoc(doc(firestore, 'projects', projectToDelete.id));

            const subcollections = ['tasks', 'links', 'resources', 'assignments', 'calendars', 'views', 'settings', 'members'];
            for (const sub of subcollections) {
                const subColQuery = query(collection(firestore, 'projects', projectToDelete.id, sub));
                const subColSnapshot = await getDocs(subColQuery);
                if (!subColSnapshot.empty) {
                    const deleteBatch = writeBatch(firestore);
                    subColSnapshot.forEach(doc => {
                        deleteBatch.delete(doc.ref);
                    });
                    await deleteBatch.commit();
                }
            }

            // Remove project ID from all members' user docs
            if (projectToDelete.memberIds && projectToDelete.memberIds.length > 0) {
                const memberUpdatePromises = projectToDelete.memberIds.map(memberId => {
                    const userDocRef = doc(firestore, 'users', memberId);
                    return updateDoc(userDocRef, { projectIds: arrayRemove(projectToDelete.id) });
                });
                await Promise.all(memberUpdatePromises);
            }
            
            toast({
                title: "Project Deleted",
                description: `"${projectToDelete.name}" has been deleted.`,
            });

            setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));

        } catch (error) {
             console.error("Error deleting project:", error);
            toast({
                variant: 'destructive',
                title: "Error Deleting Project",
                description: (error as Error).message || "Could not delete the project. Please try again.",
            });
        } finally {
            setIsDeleting(null);
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
                    <Button onClick={handleCreateProject} disabled={isCreating}>
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
        </div>
    );
}
