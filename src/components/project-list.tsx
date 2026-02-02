'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Copy, Trash2, Loader2, Settings, MoreHorizontal, FolderArchive, ArrowUpRight } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import type { Project } from '@/lib/types';
import type { User } from 'firebase/auth';

export type ProjectWithMetadata = Project & {
    createdAt: Date;
    taskCount?: number;
    startDate?: Date;
    finishDate?: Date;
    duration?: number;
    lastModified?: Date;
    linkedProjectIds?: string[];
    status?: string;
};

interface ProjectListProps {
    projects: ProjectWithMetadata[];
    user: User;
    isAdmin: boolean;
    isCloning: string | null;
    onOpen: (id: string) => void;
    onClone: (id: string) => void;
    onArchive: (project: ProjectWithMetadata) => void;
    onSettings: (project: ProjectWithMetadata) => void;
    onDelete: (project: ProjectWithMetadata) => void;
}

export function ProjectList({
    projects,
    user,
    isAdmin,
    isCloning,
    onOpen,
    onClone,
    onArchive,
    onSettings,
    onDelete
}: ProjectListProps) {
    const [groupBy, setGroupBy] = useState<'none' | 'owner' | 'status'>('none');
    const [showArchived, setShowArchived] = useState(false);

    const groupedProjects = useMemo(() => {
        const filtered = projects.filter(p => showArchived || p.status !== 'Archived');

        if (groupBy === 'none') return { 'All Projects': filtered };

        return filtered.reduce((acc, project) => {
            let key = 'Other';
            if (groupBy === 'owner') key = project.ownerId === user.uid ? 'My Projects' : 'Shared with me';
            if (groupBy === 'status') key = project.status || 'Active';

            if (!acc[key]) acc[key] = [];
            acc[key].push(project);
            return acc;
        }, {} as Record<string, ProjectWithMetadata[]>);
    }, [projects, groupBy, user.uid, showArchived]);

    const sortedGroups = Object.keys(groupedProjects).sort();

    if (projects.length === 0) {
        return (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <h2 className="text-xl font-semibold text-muted-foreground">No projects yet</h2>
                <p className="text-muted-foreground mt-2">Get started by creating your first project.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="w-[180px]">
                        <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Group by..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No Grouping</SelectItem>
                                <SelectItem value="owner">Group by Owner</SelectItem>
                                <SelectItem value="status">Group by Status</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center space-x-2">
                         <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
                         <Label htmlFor="show-archived">Show Archived</Label>
                    </div>
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[300px]">Project Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Owner</TableHead>
                            <TableHead>Tasks</TableHead>
                            <TableHead>Start</TableHead>
                            <TableHead>Finish</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Last Modified</TableHead>
                            <TableHead>Interlinked</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedGroups.map(group => (
                            <React.Fragment key={group}>
                                {groupBy !== 'none' && (
                                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                                        <TableCell colSpan={10} className="font-semibold py-2">
                                            {group} ({groupedProjects[group].length})
                                        </TableCell>
                                    </TableRow>
                                )}
                                {groupedProjects[group].map((project) => (
                                    <TableRow key={project.id} className="cursor-pointer hover:bg-muted/50">
                                        <TableCell className="font-medium" onClick={() => onOpen(project.id)}>
                                            <div className="flex flex-col">
                                                <span className="text-base font-semibold">{project.name}</span>
                                                <span className="text-xs text-muted-foreground">{project.description || 'No description.'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell onClick={() => onOpen(project.id)}>
                                            <Badge variant={project.status === 'Archived' ? 'secondary' : 'default'}>
                                                {project.status || 'Active'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell onClick={() => onOpen(project.id)}>
                                                <div className="flex items-center gap-2">
                                                <Avatar className="h-6 w-6">
                                                    <AvatarFallback className="text-[10px]">{project.ownerId === user.uid ? 'You' : 'U'}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm">{project.ownerId === user.uid ? 'You' : 'User'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell onClick={() => onOpen(project.id)}>
                                            {project.taskCount ?? '-'}
                                        </TableCell>
                                        <TableCell onClick={() => onOpen(project.id)}>
                                            {project.startDate ? format(project.startDate, 'MMM d, yyyy') : '-'}
                                        </TableCell>
                                        <TableCell onClick={() => onOpen(project.id)}>
                                            {project.finishDate ? format(project.finishDate, 'MMM d, yyyy') : '-'}
                                        </TableCell>
                                        <TableCell onClick={() => onOpen(project.id)}>
                                            {project.duration ? `${project.duration} days` : '-'}
                                        </TableCell>
                                        <TableCell onClick={() => onOpen(project.id)}>
                                            {project.lastModified ? formatDistanceToNow(project.lastModified, { addSuffix: true }) : formatDistanceToNow(project.createdAt, { addSuffix: true })}
                                        </TableCell>
                                        <TableCell onClick={() => onOpen(project.id)}>
                                            {project.linkedProjectIds && project.linkedProjectIds.length > 0 ? (
                                                <div className="flex items-center gap-1 text-blue-500">
                                                    <ArrowUpRight className="h-4 w-4" />
                                                    <span>{project.linkedProjectIds.length}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => onOpen(project.id)}>
                                                            Open
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => onClone(project.id)} disabled={!!isCloning}>
                                                            {isCloning === project.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                                                            Clone
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => onArchive(project)}>
                                                            <FolderArchive className="mr-2 h-4 w-4" />
                                                            {project.status === 'Archived' ? 'Restore' : 'Archive'}
                                                        </DropdownMenuItem>
                                                        {(isAdmin || project.ownerId === user.uid) && (
                                                            <DropdownMenuItem onClick={() => onSettings(project)}>
                                                                <Settings className="mr-2 h-4 w-4" />
                                                                Settings
                                                            </DropdownMenuItem>
                                                        )}
                                                            <DropdownMenuItem onClick={() => onDelete(project)} className="text-red-600">
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </React.Fragment>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
