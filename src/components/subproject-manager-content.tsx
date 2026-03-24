'use client';

import { useState } from 'react';
import type { AppUser } from '@/types/auth';
import type { Project } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SubprojectManagerContentProps {
    user: AppUser;
    currentProjectId: string;
    existingSubprojectIds?: string[];
    onClose?: () => void;
}

export function SubprojectManagerContent({ user: _user, currentProjectId: _currentProjectId, existingSubprojectIds, onClose }: SubprojectManagerContentProps) {
    const { toast } = useToast();
    // TODO(T5): implement via API
    const availableProjects: Project[] = [];
    const linkedProjects: Project[] = [];
    const isLoading = false;
    const isSaving = false;

    const [selectedProjectToAdd, setSelectedProjectToAdd] = useState<Project | null>(null);
    const [initialsToAdd, setInitialsToAdd] = useState('');
    const [colorToAdd, setColorToAdd] = useState('');
    const [textColorToAdd, setTextColorToAdd] = useState('');
    const [criticalPathColorToAdd, setCriticalPathColorToAdd] = useState('');
    const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
    const [editInitials, setEditInitials] = useState('');
    const [editColor, setEditColor] = useState('');
    const [editTextColor, setEditTextColor] = useState('');
    const [editCriticalPathColor, setEditCriticalPathColor] = useState('');

    const handleSelectProject = (project: Project) => {
        setSelectedProjectToAdd(project);
        setInitialsToAdd(project.initials || project.name.substring(0, 2).toUpperCase());
        setColorToAdd(project.color || '#ef4444');
        setTextColorToAdd(project.textColor || '');
        setCriticalPathColorToAdd(project.criticalPathColor || '');
    };

    const handleConfirmInsert = async () => {
        // TODO(T5): implement via API
        toast({ variant: 'destructive', title: 'Not implemented', description: 'Subproject insertion not yet available.' });
    };

    const handleUnlink = async (_projectId: string) => {
        // TODO(T5): implement via API
        toast({ variant: 'destructive', title: 'Not implemented', description: 'Subproject unlinking not yet available.' });
    };

    const startEditing = (project: Project) => {
        setEditingProjectId(project.id);
        setEditInitials(project.initials || '');
        setEditColor(project.color || '#ef4444');
        setEditTextColor(project.textColor || '');
        setEditCriticalPathColor(project.criticalPathColor || '');
    };

    const cancelEditing = () => {
        setEditingProjectId(null);
    };

    const saveEditing = async (_projectId: string) => {
        // TODO(T5): implement via API
        toast({ variant: 'destructive', title: 'Not implemented', description: 'Subproject editing not yet available.' });
        setEditingProjectId(null);
    };

    const renderAddTab = () => (
        selectedProjectToAdd ? (
            <div className="flex-1 px-6 flex flex-col gap-4 py-4">
                <div className="p-4 border rounded-md bg-muted/20">
                    <h4 className="font-medium">{selectedProjectToAdd.name}</h4>
                    <p className="text-sm text-muted-foreground">{selectedProjectToAdd.description || 'No description'}</p>
                </div>
                <div className="space-y-4">
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

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <Label className="text-xs">Project Color</Label>
                            <div className="flex gap-2">
                                <Input type="color" value={colorToAdd} onChange={(e) => setColorToAdd(e.target.value)} className="h-8 w-12 p-1" />
                                <Input value={colorToAdd} onChange={(e) => setColorToAdd(e.target.value)} className="h-8 flex-1 text-xs" placeholder="#RRGGBB" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Text Color</Label>
                            <div className="flex gap-2">
                                <Input type="color" value={textColorToAdd} onChange={(e) => setTextColorToAdd(e.target.value)} className="h-8 w-12 p-1" />
                                <Input value={textColorToAdd} onChange={(e) => setTextColorToAdd(e.target.value)} className="h-8 flex-1 text-xs" placeholder="Optional" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Critical Path Color</Label>
                            <div className="flex gap-2">
                                <Input type="color" value={criticalPathColorToAdd} onChange={(e) => setCriticalPathColorToAdd(e.target.value)} className="h-8 w-12 p-1" />
                                <Input value={criticalPathColorToAdd} onChange={(e) => setCriticalPathColorToAdd(e.target.value)} className="h-8 flex-1 text-xs" placeholder="Optional" />
                            </div>
                        </div>
                    </div>
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
                                            <Input value={editInitials} onChange={(e) => setEditInitials(e.target.value.toUpperCase())} maxLength={5} className="h-8" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Project Color</Label>
                                            <div className="flex gap-2">
                                                <Input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="h-8 w-12 p-1" />
                                                <Input value={editColor} onChange={(e) => setEditColor(e.target.value)} className="h-8 flex-1 text-xs" placeholder="#RRGGBB" />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Text Color</Label>
                                            <div className="flex gap-2">
                                                <Input type="color" value={editTextColor} onChange={(e) => setEditTextColor(e.target.value)} className="h-8 w-12 p-1" />
                                                <Input value={editTextColor} onChange={(e) => setEditTextColor(e.target.value)} className="h-8 flex-1 text-xs" placeholder="Default" />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Critical Path Color</Label>
                                            <div className="flex gap-2">
                                                <Input type="color" value={editCriticalPathColor} onChange={(e) => setEditCriticalPathColor(e.target.value)} className="h-8 w-12 p-1" />
                                                <Input value={editCriticalPathColor} onChange={(e) => setEditCriticalPathColor(e.target.value)} className="h-8 flex-1 text-xs" placeholder="Default" />
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

    return (
        <Tabs defaultValue={existingSubprojectIds && existingSubprojectIds.length > 0 ? "manage" : "add"} className="flex-1 flex flex-col overflow-hidden w-full h-full">
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
            {onClose && (
                 <div className="px-6 py-4 border-t">
                    <Button variant="outline" onClick={onClose} className="w-full">Close</Button>
                </div>
            )}
        </Tabs>
    );
}
