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
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import type { Project, ProjectState, ProjectMember, ColumnSpec, Invitation, Baseline } from "@/lib/types";
import { useState, useEffect, useMemo } from 'react';
import { collection, doc, writeBatch, updateDoc, arrayUnion, arrayRemove, addDoc, query, where, deleteDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/firebase";
import { format } from "date-fns";

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
    const firestore = useFirestore();
    const { currentUser } = useAuth();
    const { toast } = useToast();

    // Fetch confirmed members
    const membersQuery = useMemoFirebase(() => project ? collection(firestore, 'projects', project.id, 'members') : null, [firestore, project.id]);
    const { data: fetchedMembers, isLoading: membersLoading } = useCollection<ProjectMember>(membersQuery);
    
    // Fetch pending invitations for this project
    const invitationsQuery = useMemoFirebase(() => project ? query(collection(firestore, "invitations"), where("projectId", "==", project.id)) : null, [firestore, project.id]);
    const { data: fetchedInvitations, isLoading: invitationsLoading } = useCollection<Invitation>(invitationsQuery);

    const [name, setName] = useState(project.name);
    const [description, setDescription] = useState(project.description || '');
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
    
    const handleAddUser = async () => {
        if (!inviteEmail.trim() || !currentUser) {
            toast({ variant: 'destructive', title: "Error", description: "Please enter a valid email address." });
            return;
        }
        setIsAddingUser(true);
        try {
            const invitationsRef = collection(firestore, 'invitations');
            await addDoc(invitationsRef, {
                email: inviteEmail,
                projectId: project.id,
                role: inviteRole,
                invitedBy: currentUser.uid,
            });
            toast({ title: "Access Granted", description: `${inviteEmail} can now access the project upon signing in.` });
            setInviteEmail('');
            setInviteRole('viewer');
        } catch (e) {
            console.error("Error adding user:", e);
            toast({ variant: 'destructive', title: "Error", description: "Could not add user. Please try again." });
        } finally {
            setIsAddingUser(false);
        }
    };

    const handleRemoveInvitation = async (invitationId: string) => {
        if (!firestore) return;
        setIsRemovingInvitation(invitationId);
        try {
            await deleteDoc(doc(firestore, "invitations", invitationId));
            toast({ title: "Invitation revoked" });
        } catch (error) {
            console.error("Error revoking invitation:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not revoke the invitation." });
        } finally {
            setIsRemovingInvitation(null);
        }
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

                     {/* Members & Baselines Section */}
                    <div className="space-y-4 flex-grow flex flex-col min-h-0">
                        <Accordion type="multiple" className="w-full" value={accordionValue} onValueChange={setAccordionValue}>
                            <AccordionItem value="members">
                                <AccordionTrigger>Members & Permissions</AccordionTrigger>
                                <AccordionContent>
                                    <div className="flex-grow border rounded-md overflow-hidden min-h-[200px]">
                                        <ScrollArea className="h-[200px]">
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
                                                                        disabled={member.role === 'owner' || project.ownerId !== currentUser?.uid}
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
                                                                                    disabled={member.userId === currentUser?.uid}
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
                            {projectState && dispatch && (
                            <AccordionItem value="baselines">
                                <AccordionTrigger>Baselines</AccordionTrigger>
                                <AccordionContent>
                                     <div className="flex-grow border rounded-md overflow-hidden min-h-[200px]">
                                         <ScrollArea className="h-[200px]">
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
                                         </ScrollArea>
                                     </div>
                                     <Button className="mt-4" variant="outline" onClick={() => setIsSaveBaselineOpen(true)}>Set Current Schedule as Baseline</Button>
                                </AccordionContent>
                            </AccordionItem>
                            )}
                        </Accordion>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save
                    </Button>
                </DialogFooter>

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

            </DialogContent>
        </Dialog>
    );
}
