'use client';

import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { useFirestore } from '@/firebase';
import { collection, doc, getDocs, updateDoc, arrayUnion, arrayRemove, query, getDoc } from 'firebase/firestore';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, ArrowLeft, Trash2, Edit2, Check, X } from 'lucide-react';
import { useIsMobile } from "@/hooks/use-mobile";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SubprojectManagerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: User;
    currentProjectId: string;
    existingSubprojectIds?: string[];
}

export function SubprojectManagerDialog({ open, onOpenChange, user, currentProjectId, existingSubprojectIds }: SubprojectManagerDialogProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
    const [linkedProjects, setLinkedProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
    const isMobile = useIsMobile();

    // State for "Add Project" flow
    const [selectedProjectToAdd, setSelectedProjectToAdd] = useState<Project | null>(null);
    const [initialsToAdd, setInitialsToAdd] = useState('');

    // State for "Edit Project" flow
    const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
    const [editInitials, setEditInitials] = useState('');
    const [editColor, setEditColor] = useState('');

    useEffect(() => {
        if (user) {
            user.getIdTokenResult().then((idTokenResult) => {
                setIsAdmin(!!idTokenResult.claims.admin);
                setIsCheckingAdmin(false);
            });
        }
    }, [user]);

    useEffect(() => {
        if (open) {
            setSelectedProjectToAdd(null);
            setInitialsToAdd('');
            setEditingProjectId(null);
        }
    }, [open]);

    useEffect(() => {
        const fetchData = async () => {
            if (!firestore || !user || isCheckingAdmin || !open) return;
            setIsLoading(true);

            try {
                // 1. Fetch Available Projects (to add)
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
                const available = fetchedProjects.filter(p =>
                    p.id !== currentProjectId &&
                    !existingSubprojectIds?.includes(p.id)
                );
                setAvailableProjects(available.sort((a, b) => a.name.localeCompare(b.name)));

                // 2. Fetch Linked Projects (to manage)
                if (existingSubprojectIds && existingSubprojectIds.length > 0) {
                    const linkedPromises = existingSubprojectIds.map(id => getDoc(doc(firestore, 'projects', id)));
                    const linkedSnapshots = await Promise.all(linkedPromises);
                    const linked = linkedSnapshots
                        .filter(snap => snap.exists())
                        .map(snap => ({ ...snap.data(), id: snap.id } as Project));
                    setLinkedProjects(linked.sort((a, b) => a.name.localeCompare(b.name)));
                } else {
                    setLinkedProjects([]);
                }

            } catch (error) {
                console.error("Error fetching projects:", error);
                toast({
                    variant: "destructive",
                    title: "Error fetching projects",
                    description: "Could not load project lists."
                });
            } finally {
                setIsLoading(false);
            }
        };

        if (open) {
            fetchData();
        }
    }, [firestore, user, isAdmin, isCheckingAdmin, open, currentProjectId, existingSubprojectIds, toast]);

    const handleSelectProject = (project: Project) => {
        setSelectedProjectToAdd(project);
        setInitialsToAdd(project.initials || '');
    };

    const handleConfirmInsert = async () => {
        if (!firestore || !selectedProjectToAdd) return;
        if (!initialsToAdd.trim()) {
            toast({ variant: 'destructive', title: 'Initials Required', description: 'Please define initials.' });
            return;
        }

        setIsSaving(true);
        try {
            if (selectedProjectToAdd.initials !== initialsToAdd.trim()) {
                await updateDoc(doc(firestore, 'projects', selectedProjectToAdd.id), { initials: initialsToAdd.trim() });
            }
            await updateDoc(doc(firestore, 'projects', currentProjectId), {
                subprojectIds: arrayUnion(selectedProjectToAdd.id)
            });
            toast({ title: "Project Inserted", description: "The project has been added as a subproject." });
            // Don't close immediately, user might want to see it in the list?
            // Standard behavior is usually closing. But here we have tabs.
            // Let's close for now as per previous behavior.
            onOpenChange(false);
        } catch (error) {
             console.error("Error inserting project:", error);
            toast({ variant: 'destructive', title: "Error Inserting Project", description: "Could not insert the project." });
        } finally {
            setIsSaving(false);
        }
    };

    const handleUnlink = async (projectId: string) => {
        if (!firestore) return;
        setIsSaving(true);
        try {
            await updateDoc(doc(firestore, 'projects', currentProjectId), {
                subprojectIds: arrayRemove(projectId)
            });
            setLinkedProjects(prev => prev.filter(p => p.id !== projectId));
            toast({ title: "Project Unlinked", description: "The subproject has been removed." });
        } catch (error) {
            console.error("Error unlinking:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not unlink project." });
        } finally {
            setIsSaving(false);
        }
    };

    const startEditing = (project: Project) => {
        setEditingProjectId(project.id);
        setEditInitials(project.initials || '');
        setEditColor(project.color || '#ef4444');
    };

    const cancelEditing = () => {
        setEditingProjectId(null);
    };

    const saveEditing = async (projectId: string) => {
        if (!firestore) return;
        setIsSaving(true);
        try {
            await updateDoc(doc(firestore, 'projects', projectId), {
                initials: editInitials.trim(),
                color: editColor
            });
            setLinkedProjects(prev => prev.map(p => p.id === projectId ? { ...p, initials: editInitials.trim(), color: editColor } : p));
            setEditingProjectId(null);
            toast({ title: "Updated", description: "Project settings updated." });
        } catch (error) {
            console.error("Error updating:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not update project." });
        } finally {
            setIsSaving(false);
        }
    };

    const renderAddTab = () => (
        selectedProjectToAdd ? (
            <div className="flex-1 px-6 flex flex-col gap-4 py-4">
                <div className="p-4 border rounded-md bg-muted/20">
                    <h4 className="font-medium">{selectedProjectToAdd.name}</h4>
                    <p className="text-sm text-muted-foreground">{selectedProjectToAdd.description || 'No description'}</p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="project-initials">Project Initials <span className="text-destructive">*</span></Label>
                    <Input
                        id="project-initials"
                        value={initialsToAdd}
                        onChange={(e) => setInitialsToAdd(e.target.value.toUpperCase())}
                        placeholder="e.g. PRJ1"
                        maxLength={5}
                    />
                    <p className="text-xs text-muted-foreground">Prefix for tasks in cross-project links (e.g., PRJ1-1.2).</p>
                </div>
                <div className="flex gap-2 mt-4">
                    <Button variant="outline" onClick={() => setSelectedProjectToAdd(null)} disabled={isSaving}>Back</Button>
                    <Button onClick={handleConfirmInsert} disabled={isSaving || !initialsToAdd.trim()} className="flex-1">
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Insert
                    </Button>
                </div>
            </div>
        ) : (
            <ScrollArea className="h-full px-6 py-4">
                {isLoading ? (
                    <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : availableProjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-20 text-muted-foreground">
                        <p>No available projects to insert.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {availableProjects.map(project => (
                            <div key={project.id} className="flex items-center justify-between p-2 border rounded hover:bg-muted/50">
                                <div className="flex flex-col">
                                    <span className="font-medium">{project.name}</span>
                                    <span className="text-xs text-muted-foreground">{project.description || 'No description'}</span>
                                </div>
                                <Button size="sm" variant="secondary" onClick={() => handleSelectProject(project)} disabled={isSaving}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
        )
    );

    const renderManageTab = () => (
        <ScrollArea className="h-full px-6 py-4">
            {isLoading ? (
                <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : linkedProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-20 text-muted-foreground">
                    <p>No linked subprojects.</p>
                </div>
            ) : (
                <div className="space-y-3 pb-6">
                    {linkedProjects.map(project => (
                        <div key={project.id} className="p-3 border rounded bg-card">
                            {editingProjectId === project.id ? (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium">{project.name}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Initials</Label>
                                            <Input
                                                value={editInitials}
                                                onChange={(e) => setEditInitials(e.target.value.toUpperCase())}
                                                maxLength={5}
                                                className="h-8"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Color</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="color"
                                                    value={editColor}
                                                    onChange={(e) => setEditColor(e.target.value)}
                                                    className="h-8 w-12 p-1"
                                                />
                                                <Input
                                                    value={editColor}
                                                    onChange={(e) => setEditColor(e.target.value)}
                                                    className="h-8 flex-1"
                                                    placeholder="#RRGGBB"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <Button size="sm" variant="ghost" onClick={cancelEditing}><X className="h-4 w-4 mr-1" /> Cancel</Button>
                                        <Button size="sm" onClick={() => saveEditing(project.id)} disabled={isSaving}><Check className="h-4 w-4 mr-1" /> Save</Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="font-medium">{project.name}</span>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className="bg-muted px-1 rounded">{project.initials}</span>
                                            {project.color && (
                                                <span className="flex items-center gap-1">
                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
                                                    <span className="opacity-70">{project.color}</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button size="sm" variant="ghost" onClick={() => startEditing(project)} disabled={isSaving}>
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleUnlink(project.id)} disabled={isSaving}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </ScrollArea>
    );

    if (isMobile) {
        return (
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent side="left" className="flex flex-col p-0 gap-0 w-full sm:max-w-md h-full">
                     <SheetHeader className="px-6 py-4 border-b">
                        <SheetTitle>Manage Subprojects</SheetTitle>
                        <SheetDescription>Link or manage subprojects.</SheetDescription>
                    </SheetHeader>
                    <Tabs defaultValue={existingSubprojectIds && existingSubprojectIds.length > 0 ? "manage" : "add"} className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-6 pt-2">
                            <TabsList className="w-full">
                                <TabsTrigger value="add" className="flex-1">Add</TabsTrigger>
                                <TabsTrigger value="manage" className="flex-1">Manage</TabsTrigger>
                            </TabsList>
                        </div>
                        <TabsContent value="add" className="flex-1 mt-0 overflow-hidden">
                             {renderAddTab()}
                        </TabsContent>
                        <TabsContent value="manage" className="flex-1 mt-0 overflow-hidden">
                             {renderManageTab()}
                        </TabsContent>
                    </Tabs>
                    <SheetFooter className="px-6 py-4 border-t">
                        <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">Close</Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] sm:max-h-[80vh] flex flex-col gap-0 p-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle>Manage Subprojects</DialogTitle>
                    <DialogDescription>
                        Link external projects or manage existing connections.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue={existingSubprojectIds && existingSubprojectIds.length > 0 ? "manage" : "add"} className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 pt-2">
                        <TabsList className="w-full">
                            <TabsTrigger value="add" className="flex-1">Add Project</TabsTrigger>
                            <TabsTrigger value="manage" className="flex-1">Linked Projects</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="add" className="flex-1 mt-0 overflow-hidden">
                        {renderAddTab()}
                    </TabsContent>

                    <TabsContent value="manage" className="flex-1 mt-0 overflow-hidden">
                        {renderManageTab()}
                    </TabsContent>
                </Tabs>

                <DialogFooter className="px-6 py-4 border-t">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
