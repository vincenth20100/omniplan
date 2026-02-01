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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, ArrowLeft } from 'lucide-react';
import { useIsMobile } from "@/hooks/use-mobile";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    const isMobile = useIsMobile();

    // State for the selected project to insert (Second Step)
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [initials, setInitials] = useState('');

    useEffect(() => {
        if (user) {
            user.getIdTokenResult().then((idTokenResult) => {
                setIsAdmin(!!idTokenResult.claims.admin);
                setIsCheckingAdmin(false);
            });
        }
    }, [user]);

    useEffect(() => {
        // Reset state when dialog opens
        if (open) {
            setSelectedProject(null);
            setInitials('');
        }
    }, [open]);

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

    const handleSelectProject = (project: Project) => {
        setSelectedProject(project);
        setInitials(project.initials || '');
    };

    const handleConfirmInsert = async () => {
        if (!firestore || !selectedProject) return;
        if (!initials.trim()) {
            toast({
                variant: 'destructive',
                title: 'Initials Required',
                description: 'Please define initials for the linked project.',
            });
            return;
        }

        setIsSaving(true);
        try {
            // 1. Update the subproject with the new initials if changed or missing
            if (selectedProject.initials !== initials.trim()) {
                const subprojectRef = doc(firestore, 'projects', selectedProject.id);
                await updateDoc(subprojectRef, {
                    initials: initials.trim()
                });
            }

            // 2. Link the subproject to the current project
            const projectRef = doc(firestore, 'projects', currentProjectId);
            await updateDoc(projectRef, {
                subprojectIds: arrayUnion(selectedProject.id)
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

    const renderList = () => (
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
                                    onClick={() => handleSelectProject(project)}
                                    disabled={isSaving}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </ScrollArea>
    );

    const renderForm = () => (
        <div className="flex-1 px-6 flex flex-col gap-4">
            <div className="p-4 border rounded-md bg-muted/20">
                <h4 className="font-medium">{selectedProject?.name}</h4>
                <p className="text-sm text-muted-foreground">{selectedProject?.description || 'No description'}</p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="project-initials">
                    Project Initials <span className="text-destructive">*</span>
                </Label>
                <Input
                    id="project-initials"
                    value={initials}
                    onChange={(e) => setInitials(e.target.value.toUpperCase())}
                    placeholder="e.g. PRJ1"
                    maxLength={5}
                />
                <p className="text-xs text-muted-foreground">
                    These initials will be used as a prefix for tasks in cross-project links (e.g., PRJ1-1.2).
                </p>
            </div>
        </div>
    );

    const handleBack = () => {
        setSelectedProject(null);
    };

    if (isMobile) {
        return (
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent side="left" className="flex flex-col p-0 gap-0 w-full sm:max-w-md">
                     <SheetHeader className="px-6 py-4">
                        <SheetTitle>{selectedProject ? "Configure Link" : "Insert Project"}</SheetTitle>
                        <SheetDescription>
                            {selectedProject
                                ? "Define settings for the linked project."
                                : "Select a project to insert into the current project hierarchy."
                            }
                        </SheetDescription>
                    </SheetHeader>
                    {selectedProject ? renderForm() : renderList()}
                    <SheetFooter className="px-6 py-4">
                        <div className="flex gap-2 w-full">
                            {selectedProject ? (
                                <>
                                    <Button variant="outline" onClick={handleBack} disabled={isSaving}>
                                        Back
                                    </Button>
                                    <Button onClick={handleConfirmInsert} disabled={isSaving || !initials.trim()} className="flex-1">
                                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Insert Project
                                    </Button>
                                </>
                            ) : (
                                <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">Close</Button>
                            )}
                        </div>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex flex-col p-0 gap-0 sm:max-w-[425px] sm:max-h-[90vh]">
                <DialogHeader className="px-6 py-4">
                    <DialogTitle>{selectedProject ? "Configure Link" : "Insert Project"}</DialogTitle>
                    <DialogDescription>
                         {selectedProject
                                ? "Define settings for the linked project."
                                : "Select a project to insert into the current project hierarchy."
                         }
                    </DialogDescription>
                </DialogHeader>
                {selectedProject ? renderForm() : renderList()}
                <DialogFooter className="px-6 py-4">
                    {selectedProject ? (
                        <>
                            <Button variant="outline" onClick={handleBack} disabled={isSaving}>
                                <ArrowLeft className="mr-2 h-4 w-4" /> Back
                            </Button>
                            <Button onClick={handleConfirmInsert} disabled={isSaving || !initials.trim()}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Insert Project
                            </Button>
                        </>
                    ) : (
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
