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
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import type { Project, ProjectMember, ColumnSpec } from "@/lib/types";
import { useState, useEffect } from 'react';
import { collection, doc, writeBatch, updateDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type EditableMember = ProjectMember & { originalRole: ProjectMember['role'] };

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
    const { toast } = useToast();
    const membersQuery = useMemoFirebase(() => project ? collection(firestore, 'projects', project.id, 'members') : null, [firestore, project.id]);
    const { data: fetchedMembers } = useCollection<ProjectMember>(membersQuery);
    
    const [name, setName] = useState(project.name);
    const [description, setDescription] = useState(project.description || '');
    const [members, setMembers] = useState<EditableMember[]>([]);
    const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
    const [editorHiddenColumns, setEditorHiddenColumns] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setName(project.name);
            setDescription(project.description || '');
            setHiddenColumns(project.rolePermissions?.viewer?.hiddenColumns || []);
            setEditorHiddenColumns(project.rolePermissions?.editor?.hiddenColumns || []);
        }
    }, [open, project]);
    
    useEffect(() => {
        if (fetchedMembers) {
            setMembers(fetchedMembers.map(m => ({ ...m, originalRole: m.role })));
        }
    }, [fetchedMembers]);

    const handleRoleChange = (userId: string, newRole: 'editor' | 'viewer') => {
        setMembers(members.map(m => m.userId === userId ? { ...m, role: newRole } : m));
    }

    const handleColumnVisibilityChange = (columnId: string, checked: boolean) => {
        if (checked) {
            setHiddenColumns([...hiddenColumns, columnId]);
        } else {
            setHiddenColumns(hiddenColumns.filter(id => id !== columnId));
        }
    };

    const handleEditorColumnVisibilityChange = (columnId: string, checked: boolean) => {
        if (checked) {
            setEditorHiddenColumns([...editorHiddenColumns, columnId]);
        } else {
            setEditorHiddenColumns(editorHiddenColumns.filter(id => id !== columnId));
        }
    };

    const handleSave = async () => {
        if (!firestore) return;
        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);

            // 1. Update Project Document
            const projectDocRef = doc(firestore, 'projects', project.id);
            const projectUpdates: Partial<Project> = {};
            if (name !== project.name) projectUpdates.name = name;
            if (description !== (project.description || '')) projectUpdates.description = description;

            const newRolePermissions = {
                viewer: { hiddenColumns },
                editor: { hiddenColumns: editorHiddenColumns }
            };
            if (JSON.stringify(newRolePermissions) !== JSON.stringify(project.rolePermissions || {})) {
                 projectUpdates.rolePermissions = newRolePermissions;
            }
            
            if (Object.keys(projectUpdates).length > 0) {
                batch.update(projectDocRef, projectUpdates);
            }

            // 2. Update Member Roles
            members.forEach(member => {
                if (member.role !== member.originalRole) {
                    const memberDocRef = doc(firestore, 'projects', project.id, 'members', member.userId);
                    batch.update(memberDocRef, { role: member.role });
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
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Project Settings</DialogTitle>
                </DialogHeader>
                <div className="grid gap-6 py-4">
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
                    <div className="space-y-2">
                        <h3 className="font-semibold">Members</h3>
                        <ScrollArea className="h-48 border rounded-md p-2">
                            {members.map(member => (
                                <div key={member.userId} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={member.photoURL} alt={member.displayName} />
                                            <AvatarFallback>{member.displayName?.charAt(0) || 'U'}</AvatarFallback>
                                        </Avatar>
                                        <span>{member.displayName}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground capitalize">{member.role}</span>
                                        {member.role !== 'owner' && (
                                            <Select value={member.role} onValueChange={(newRole: 'editor' | 'viewer') => handleRoleChange(member.userId, newRole)}>
                                                <SelectTrigger className="w-[120px] h-8">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="editor">Editor</SelectItem>
                                                    <SelectItem value="viewer">Viewer</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </ScrollArea>
                    </div>
                     <Separator />
                     {/* Viewer Permissions */}
                     <div className="space-y-2">
                        <h3 className="font-semibold">Viewer Permissions</h3>
                        <p className="text-sm text-muted-foreground">Select columns to hide from users with the "Viewer" role.</p>
                        <ScrollArea className="h-48 border rounded-md p-4">
                            <div className="grid grid-cols-2 gap-4">
                                {allColumns.filter(c => c.id !== 'wbs' && c.id !== 'name').map(col => (
                                    <div key={col.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`col-vis-${col.id}`}
                                            checked={hiddenColumns.includes(col.id)}
                                            onCheckedChange={(checked) => handleColumnVisibilityChange(col.id, !!checked)}
                                        />
                                        <label
                                            htmlFor={`col-vis-${col.id}`}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                            {col.name}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                     </div>
                     <Separator />
                     {/* Editor Permissions */}
                     <div className="space-y-2">
                        <h3 className="font-semibold">Editor Permissions</h3>
                        <p className="text-sm text-muted-foreground">Select columns to hide from users with the "Editor" role.</p>
                        <ScrollArea className="h-48 border rounded-md p-4">
                            <div className="grid grid-cols-2 gap-4">
                                {allColumns.filter(c => c.id !== 'wbs' && c.id !== 'name').map(col => (
                                    <div key={col.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`col-vis-editor-${col.id}`}
                                            checked={editorHiddenColumns.includes(col.id)}
                                            onCheckedChange={(checked) => handleEditorColumnVisibilityChange(col.id, !!checked)}
                                        />
                                        <label
                                            htmlFor={`col-vis-editor-${col.id}`}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                            {col.name}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
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
