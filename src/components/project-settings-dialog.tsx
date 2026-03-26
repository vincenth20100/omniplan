'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
import type { Project, ProjectState, ProjectMember, ColumnSpec, Invitation, Baseline } from "@/lib/types";
import { useState, useEffect, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Plus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { format } from "date-fns";
import { projectApi } from "@/services/project-api";

type EditableMember = ProjectMember & {
    originalRole: ProjectMember['role'];
    originalPermissions: ProjectMember['permissions'];
};

export function ProjectSettingsDialog({
    open,
    onOpenChange,
    project,
    projectState,
    allColumns,
    onProjectUpdate,
    dispatch,
    initialOpenSection = 'members',
}: {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    project: Project,
    projectState?: ProjectState,
    allColumns: (Omit<ColumnSpec, 'width'> & { defaultWidth: number })[],
    onProjectUpdate: (updatedProject: Partial<Project>) => void,
    dispatch?: any,
    initialOpenSection?: 'members' | 'baselines',
}) {
    const { user: currentUser } = useAuth();
    const { toast } = useToast();

    // TODO(T5): implement via API
    const fetchedMembers: ProjectMember[] | undefined = [];
    const membersLoading = false;
    const fetchedInvitations: Invitation[] | undefined = [];
    const invitationsLoading = false;
    const availableProjectsData: Project[] = [];

    const [name, setName] = useState(project.name);
    const [initials, setInitials] = useState(project.initials || '');
    const [description, setDescription] = useState(project.description || '');
    const [color, setColor] = useState(project.color || '#ef4444');
    const [textColor, setTextColor] = useState(project.textColor || '');
    const [criticalPathColor, setCriticalPathColor] = useState(project.criticalPathColor || '');
    const [members, setMembers] = useState<EditableMember[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer');
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [isRemovingInvitation, setIsRemovingInvitation] = useState<string | null>(null);

    const [isSaveBaselineOpen, setIsSaveBaselineOpen] = useState(false);
    const [newBaselineName, setNewBaselineName] = useState("");
    const [baselineToDelete, setBaselineToDelete] = useState<Baseline | null>(null);
    const [accordionValue, setAccordionValue] = useState<string[]>([]);

    const [availableProjects, setAvailableProjects] = useState<Project[]>(availableProjectsData);
    const [subprojectIds, setSubprojectIds] = useState<string[]>(project.subprojectIds || []);
    const [selectedSubprojectToAdd, setSelectedSubprojectToAdd] = useState<string>('');

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
            setInitials(project.initials || project.name.substring(0, 2).toUpperCase());
            setDescription(project.description || '');
            setColor(project.color || '#ef4444');
            setTextColor(project.textColor || '');
            setCriticalPathColor(project.criticalPathColor || '');
            setMembers(originalMembers);
            setSubprojectIds(project.subprojectIds || []);
            
            const openSections = ['members'];
            if (initialOpenSection === 'baselines' && projectState) {
                openSections.push('baselines');
            }
            setAccordionValue(openSections);
        }
    }, [open, project, originalMembers, initialOpenSection, projectState]);

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
            ? currentHidden.filter(id => id !== columnId)
            : [...currentHidden, columnId];
        
        handleMemberChange(userId, { permissions: { ...(member.permissions || {}), hiddenColumns: newHidden } });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const projectUpdates: Partial<Project> = {};
            if (name !== project.name) projectUpdates.name = name;
            if (initials !== (project.initials || '')) projectUpdates.initials = initials;
            if (description !== (project.description || '')) projectUpdates.description = description;
            if (color !== (project.color || '#ef4444')) projectUpdates.color = color;
            if (textColor !== (project.textColor || '')) projectUpdates.textColor = textColor;
            if (criticalPathColor !== (project.criticalPathColor || '')) projectUpdates.criticalPathColor = criticalPathColor;
            if (JSON.stringify(subprojectIds) !== JSON.stringify(project.subprojectIds || [])) {
                projectUpdates.subprojectIds = subprojectIds;
            }

            await projectApi.updateProject(project.id, projectUpdates);

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
    
    const handleAddUser = async () => {
        // TODO(T5): implement via API
        toast({ variant: 'destructive', title: "Not implemented", description: "User invitation not yet available." });
    };

    const handleRemoveInvitation = async (_invitationId: string) => {
        // TODO(T5): implement via API
        toast({ variant: "destructive", title: "Not implemented", description: "Invitation revocation not yet available." });
    };

    const handleSaveBaseline = () => {
        if (!newBaselineName.trim() || !dispatch) return;
        dispatch({ type: "ADD_BASELINE", payload: { name: newBaselineName } });
        setIsSaveBaselineOpen(false);
        setNewBaselineName("");
        toast({ title: "Baseline Saved" });
    };

    const handleDeleteBaseline = () => {
        if (!baselineToDelete || !dispatch) return;
        dispatch({ type: "DELETE_BASELINE", payload: { baselineId: baselineToDelete.id } });
        setBaselineToDelete(null);
        toast({ title: "Baseline Deleted" });
    };

    const handleAddSubproject = () => {
        if (selectedSubprojectToAdd && !subprojectIds.includes(selectedSubprojectToAdd)) {
            setSubprojectIds([...subprojectIds, selectedSubprojectToAdd]);
            setSelectedSubprojectToAdd('');
        }
    };

    const handleRemoveSubproject = (idToRemove: string) => {
        setSubprojectIds(subprojectIds.filter(id => id !== idToRemove));
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="flex flex-col p-0 gap-0 h-full sm:max-w-4xl sm:max-h-[90vh]">
                    <DialogHeader className="px-6 py-4">
                        <DialogTitle>Project Settings</DialogTitle>
                    </DialogHeader>

                    <ScrollArea className="flex-1 px-6">
                        <div className="flex flex-col gap-6 pb-6">
                            {/* Project Details */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 sm:col-span-1">
                                        <Label htmlFor="project-name">Project Name</Label>
                                        <Input id="project-name" value={name} onChange={e => setName(e.target.value)} />
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <Label htmlFor="project-initials">Initials</Label>
                                        <Input
                                            id="project-initials"
                                            value={initials}
                                            onChange={e => setInitials(e.target.value.toUpperCase())}
                                            maxLength={5}
                                            placeholder="e.g. PRJ"
                                        />
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <Label>Project Color</Label>
                                        <div className="flex gap-2">
                                            <Input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-12 p-1 h-9" />
                                            <Input value={color} onChange={e => setColor(e.target.value)} className="flex-1" placeholder="#RRGGBB" />
                                        </div>
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <Label>Text Color</Label>
                                        <div className="flex gap-2">
                                            <Input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="w-12 p-1 h-9" />
                                            <Input value={textColor} onChange={e => setTextColor(e.target.value)} className="flex-1" placeholder="Optional" />
                                        </div>
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <Label>Critical Path Color</Label>
                                        <div className="flex gap-2">
                                            <Input type="color" value={criticalPathColor} onChange={e => setCriticalPathColor(e.target.value)} className="w-12 p-1 h-9" />
                                            <Input value={criticalPathColor} onChange={e => setCriticalPathColor(e.target.value)} className="flex-1" placeholder="Optional" />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="project-description">Description</Label>
                                    <Textarea id="project-description" value={description} onChange={e => setDescription(e.target.value)} />
                                </div>
                            </div>
                            <Separator />

                            {/* Members & Baselines Section */}
                            <Accordion type="multiple" className="w-full" value={accordionValue} onValueChange={setAccordionValue}>
                                <AccordionItem value="members">
                                    <AccordionTrigger>Members & Permissions</AccordionTrigger>
                                    <AccordionContent>
                                        <div className="border rounded-md overflow-hidden">
                                            <div className="p-2">
                                                {/* Pending Invitations List */}
                                                {fetchedInvitations && fetchedInvitations.length > 0 && (
                                                    <div className="mb-4">
                                                        <h4 className="font-semibold text-sm px-2 mb-2">Pending Invitations</h4>
                                                        <div className="space-y-1">
                                                            {fetchedInvitations.map(invitation => (
                                                                <div key={invitation.id} className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50">
                                                                    <div className="flex items-center gap-3">
                                                                        <Avatar className="h-8 w-8">
                                                                            <AvatarFallback>?</AvatarFallback>
                                                                        </Avatar>
                                                                        <span className="text-sm text-muted-foreground">{invitation.email}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-4">
                                                                        <span className="text-sm capitalize text-muted-foreground">{invitation.role}</span>
                                                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveInvitation(invitation.id)} disabled={isRemovingInvitation === invitation.id}>
                                                                            {isRemovingInvitation === invitation.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Confirmed Members List */}
                                                <Accordion type="multiple" className="w-full">
                                                    {members.map(member => (
                                                        <AccordionItem value={member.userId} key={member.userId}>
                                                            <div className="flex items-center justify-between w-full hover:bg-accent/50 rounded-md">
                                                                <AccordionTrigger className="flex-1 py-2 px-2">
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
                                                                        disabled={member.role === 'owner' || project.ownerId !== currentUser?.id}
                                                                    >
                                                                        <SelectTrigger className="w-[120px] h-8">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="owner" disabled>Owner</SelectItem>
                                                                            <SelectItem value="editor">Editor</SelectItem>
                                                                            <SelectItem value="viewer">Viewer</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            </div>
                                                            <AccordionContent>
                                                                <div className="p-4 bg-muted/50 rounded-md">
                                                                    <h4 className="font-semibold text-sm mb-2">Column Permissions</h4>
                                                                    <p className="text-xs text-muted-foreground mb-4">Uncheck columns to HIDE them for this user.</p>
                                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                                        {allColumns.filter(c => c.id !== 'wbs' && c.id !== 'name').map(col => (
                                                                            <div key={col.id} className="flex items-center space-x-2">
                                                                                <Checkbox
                                                                                    id={`col-vis-${member.userId}-${col.id}`}
                                                                                    checked={!member.permissions?.hiddenColumns?.includes(col.id)}
                                                                                    onCheckedChange={(checked) => handleColumnVisibilityChange(member.userId, col.id, !!checked)}
                                                                                    disabled={member.userId === currentUser?.id}
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
                                        </div>
                                        <div className="mt-4 space-y-2">
                                            <h3 className="font-semibold text-sm">Add New Member</h3>
                                            <div className="flex items-center gap-2">
                                                <Input placeholder="user@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                                                <Select value={inviteRole} onValueChange={(value: 'editor' | 'viewer') => setInviteRole(value)}>
                                                    <SelectTrigger className="w-[180px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="editor">Editor</SelectItem>
                                                        <SelectItem value="viewer">Viewer</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Button onClick={handleAddUser} disabled={isAddingUser || !inviteEmail.trim()}>
                                                    {isAddingUser ? <Loader2 className="animate-spin" /> : 'Add User'}
                                                </Button>
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <AccordionItem value="subprojects">
                                    <AccordionTrigger>Subprojects</AccordionTrigger>
                                    <AccordionContent>
                                        <div className="border rounded-md overflow-hidden">
                                            <div className="p-2 space-y-2">
                                                {subprojectIds.map(subId => {
                                                    const subProj = availableProjects.find(p => p.id === subId);
                                                    return (
                                                        <div key={subId} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                                                            <div>
                                                                <p className="font-medium">{subProj?.name || 'Unknown Project'}</p>
                                                                <p className="text-xs text-muted-foreground">{subId}</p>
                                                            </div>
                                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveSubproject(subId)}>
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </div>
                                                    );
                                                })}
                                                {subprojectIds.length === 0 && (
                                                    <p className="p-4 text-center text-sm text-muted-foreground">No subprojects added.</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="mt-4 flex items-center gap-2">
                                            <Select value={selectedSubprojectToAdd} onValueChange={setSelectedSubprojectToAdd}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select project to add..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableProjects
                                                        .filter(p => !subprojectIds.includes(p.id))
                                                        .map(p => (
                                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                        ))
                                                    }
                                                </SelectContent>
                                            </Select>
                                            <Button onClick={handleAddSubproject} disabled={!selectedSubprojectToAdd}>
                                                <Plus className="h-4 w-4 mr-2" /> Add
                                            </Button>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                {projectState && dispatch && (
                                <AccordionItem value="baselines">
                                    <AccordionTrigger>Baselines</AccordionTrigger>
                                    <AccordionContent>
                                        <div className="border rounded-md overflow-hidden">
                                            <div className="p-2 space-y-2">
                                                {projectState.baselines.map((b: Baseline) => (
                                                    <div key={b.id} className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50">
                                                        <div>
                                                            <p className="font-medium">{b.name}</p>
                                                            <p className="text-xs text-muted-foreground">Saved on {format(new Date(b.createdAt), 'PPp')}</p>
                                                        </div>
                                                        <Button variant="ghost" size="icon" onClick={() => setBaselineToDelete(b)}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                ))}
                                                {projectState.baselines.length === 0 && (
                                                    <p className="p-4 text-center text-sm text-muted-foreground">No baselines have been saved.</p>
                                                )}
                                            </div>
                                        </div>
                                        <Button className="mt-4" variant="outline" onClick={() => setIsSaveBaselineOpen(true)}>Set Current Schedule as Baseline</Button>
                                    </AccordionContent>
                                </AccordionItem>
                                )}
                            </Accordion>
                        </div>
                    </ScrollArea>

                    <DialogFooter className="px-6 py-4 border-t">
                        <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Save Baseline Dialog */}
            <Dialog open={isSaveBaselineOpen} onOpenChange={setIsSaveBaselineOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Save New Baseline</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="baseline-name">Baseline Name</Label>
                        <Input id="baseline-name" value={newBaselineName} onChange={e => setNewBaselineName(e.target.value)} autoFocus />
                    </div>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setIsSaveBaselineOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveBaseline} disabled={!newBaselineName.trim()}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Baseline Confirmation */}
            <AlertDialog open={!!baselineToDelete} onOpenChange={() => setBaselineToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the baseline "{baselineToDelete?.name}". This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteBaseline} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
