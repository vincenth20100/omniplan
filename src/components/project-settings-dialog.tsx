'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import type { Project, ProjectMember, ColumnSpec } from "@/lib/types";
import { useState, useEffect, useMemo } from 'react';
import { collection, doc, writeBatch, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/firebase";

type EditableMember = ProjectMember & {
    originalRole: ProjectMember['role'];
    originalPermissions: ProjectMember['permissions'];
};

export function ProjectSettingsDialog({
    open,
    onOpenChange,
    project,
    allColumns,
    onProjectUpdate,
}: {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    project: Project,
    allColumns: (Omit<ColumnSpec, 'width'> & { defaultWidth: number })[],
    onProjectUpdate: (updatedProject: Partial<Project>) => void
}) {
    const firestore = useFirestore();
    const currentUser = useAuth().currentUser;
    const { toast } = useToast();

    const membersQuery = useMemoFirebase(() => project ? collection(firestore, 'projects', project.id, 'members') : null, [firestore, project.id]);
    const { data: fetchedMembers, isLoading: membersLoading } = useCollection<ProjectMember>(membersQuery);
    
    const [name, setName] = useState(project.name);
    const [description, setDescription] = useState(project.description || '');
    const [members, setMembers] = useState<EditableMember[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const originalMembers = useMemo(() => {
        return fetchedMembers?.map(m => ({
            ...m,
            originalRole: m.role,
            originalPermissions: m.permissions,
        })) || [];
    }, [fetchedMembers]);
    
    useEffect(() => {
        if (open) {
            setName(project.name);
            setDescription(project.description || '');
            setMembers(originalMembers);
        }
    }, [open, project, originalMembers]);

    const handleMemberChange = (userId: string, updates: Partial<ProjectMember>) => {
        setMembers(prevMembers =>
            prevMembers.map(m => (m.userId === userId ? { ...m, ...updates } : m))
        );
    };

    const handleColumnVisibilityChange = (userId: string, columnId: string, checked: boolean) => {
        const member = members.find(m => m.userId === userId);
        if (!member) return;

        const currentHidden = member.permissions?.hiddenColumns || [];
        const newHidden = checked
            ? [...currentHidden, columnId]
            : currentHidden.filter(id => id !== columnId);
        
        handleMemberChange(userId, { permissions: { ...member.permissions, hiddenColumns: newHidden } });
    };

    const handleSave = async () => {
        if (!firestore) return;
        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            const projectDocRef = doc(firestore, 'projects', project.id);

            // 1. Update Project Document
            const projectUpdates: Partial<Project> = {};
            if (name !== project.name) projectUpdates.name = name;
            if (description !== (project.description || '')) projectUpdates.description = description;

            if (Object.keys(projectUpdates).length > 0) {
                batch.update(projectDocRef, projectUpdates);
            }

            // 2. Update Members
            members.forEach(member => {
                const originalMember = originalMembers.find(om => om.userId === member.userId);
                if (!originalMember || JSON.stringify(member) !== JSON.stringify(originalMember)) {
                     const memberDocRef = doc(firestore, 'projects', project.id, 'members', member.userId);
                     const { originalRole, originalPermissions, ...memberData } = member;
                     batch.update(memberDocRef, memberData);
                }
            });

            await batch.commit();

            toast({ title: "Project settings saved!" });
            onProjectUpdate(projectUpdates);
            onOpenChange(false);
        } catch (error) {
            console.error("Error saving settings:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not save project settings." });
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Project Settings</DialogTitle>
                </DialogHeader>
                
                <div className="flex-grow overflow-hidden flex flex-col gap-6">
                    {/* Project Details */}
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="project-name">Project Name</Label>
                            <Input id="project-name" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="project-description">Description</Label>
                            <Textarea id="project-description" value={description} onChange={e => setDescription(e.target.value)} />
                        </div>
                    </div>
                    <Separator />

                     {/* Members */}
                    <div className="space-y-2 flex-grow flex flex-col min-h-0">
                        <h3 className="font-semibold">Members</h3>
                        <div className="flex-grow border rounded-md overflow-hidden">
                             <ScrollArea className="h-full">
                                <div className="p-2">
                                     <Accordion type="multiple" className="w-full">
                                        {members.map(member => (
                                            <AccordionItem value={member.userId} key={member.userId}>
                                                <div className="flex items-center justify-between w-full">
                                                    <AccordionTrigger>
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-8 w-8">
                                                                <AvatarImage src={member.photoURL} alt={member.displayName} />
                                                                <AvatarFallback>{member.displayName?.charAt(0) || 'U'}</AvatarFallback>
                                                            </Avatar>
                                                            <span>{member.displayName}</span>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <div className="flex items-center gap-4 pr-4" onClick={(e) => e.stopPropagation()}>
                                                            <Select
                                                            value={member.role}
                                                            onValueChange={(newRole: 'editor' | 'viewer') => handleMemberChange(member.userId, { role: newRole })}
                                                            disabled={member.role === 'owner' || project.ownerId !== currentUser?.uid}
                                                            >
                                                            <SelectTrigger className="w-[120px] h-8">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="editor">Editor</SelectItem>
                                                                <SelectItem value="viewer">Viewer</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <AccordionContent>
                                                    <div className="p-4 bg-muted/50 rounded-md">
                                                        <h4 className="font-semibold text-sm mb-2">Column Permissions</h4>
                                                        <p className="text-xs text-muted-foreground mb-4">Select columns to HIDE for this user.</p>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                             {allColumns.filter(c => c.id !== 'wbs' && c.id !== 'name').map(col => (
                                                                <div key={col.id} className="flex items-center space-x-2">
                                                                    <Checkbox
                                                                        id={`col-vis-${member.userId}-${col.id}`}
                                                                        checked={member.permissions?.hiddenColumns?.includes(col.id)}
                                                                        onCheckedChange={(checked) => handleColumnVisibilityChange(member.userId, col.id, !!checked)}
                                                                    />
                                                                    <label
                                                                        htmlFor={`col-vis-${member.userId}-${col.id}`}
                                                                        className="text-sm font-medium leading-none"
                                                                    >
                                                                        {col.name}
                                                                    </label>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                     </Accordion>
                                </div>
                             </ScrollArea>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
