'use client';

import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { useFirestore } from '@/firebase';
import { collection, doc, getDocs, updateDoc, arrayUnion, query, getDoc } from 'firebase/firestore';
import type { Project } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus } from 'lucide-react';

interface InsertSubprojectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: User;
    currentProjectId: string;
    existingSubprojectIds?: string[];
}

export function InsertSubprojectDialog({ open, onOpenChange, user, currentProjectId, existingSubprojectIds }: InsertSubprojectDialogProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

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
            if (!firestore || !user || isCheckingAdmin || !open) return;
            setIsLoading(true);

            try {
                let fetchedProjects: Project[] = [];

                if (isAdmin) {
                    const projectsQuery = query(collection(firestore, 'projects'));
                    const querySnapshot = await getDocs(projectsQuery);
                    fetchedProjects = querySnapshot.docs.map(snap => ({ ...snap.data(), id: snap.id } as Project));
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
                                .map(snap => ({ ...snap.data(), id: snap.id } as Project));
                        }
                    }
                }

                // Filter out current project and already added subprojects
                const filtered = fetchedProjects.filter(p =>
                    p.id !== currentProjectId &&
                    !existingSubprojectIds?.includes(p.id)
                );

                setProjects(filtered.sort((a, b) => a.name.localeCompare(b.name)));

            } catch (error) {
                console.error("Error fetching projects:", error);
                toast({
                    variant: "destructive",
                    title: "Error fetching projects",
                    description: "Could not load available projects."
                });
            } finally {
                setIsLoading(false);
            }
        };

        if (open) {
            fetchProjects();
        }
    }, [firestore, user, isAdmin, isCheckingAdmin, open, currentProjectId, existingSubprojectIds, toast]);

    const handleInsert = async (subprojectId: string) => {
        if (!firestore) return;
        setIsSaving(true);
        try {
            const projectRef = doc(firestore, 'projects', currentProjectId);
            await updateDoc(projectRef, {
                subprojectIds: arrayUnion(subprojectId)
            });

            toast({
                title: "Project Inserted",
                description: "The project has been added as a subproject.",
            });
            onOpenChange(false);
        } catch (error) {
             console.error("Error inserting project:", error);
            toast({
                variant: 'destructive',
                title: "Error Inserting Project",
                description: "Could not insert the project.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 py-4">
                    <DialogTitle>Insert Project</DialogTitle>
                    <DialogDescription>
                        Select a project to insert into the current project hierarchy.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 px-6">
                    <div className="pb-6">
                        {isLoading || isCheckingAdmin ? (
                            <div className="flex items-center justify-center h-20">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        ) : projects.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-20 text-muted-foreground">
                                <p>No available projects to insert.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {projects.map(project => (
                                    <div key={project.id} className="flex items-center justify-between p-2 border rounded hover:bg-muted/50">
                                        <div className="flex flex-col">
                                            <span className="font-medium">{project.name}</span>
                                            <span className="text-xs text-muted-foreground">{project.description || 'No description'}</span>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => handleInsert(project.id)}
                                            disabled={isSaving}
                                        >
                                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>
                <DialogFooter className="px-6 py-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
