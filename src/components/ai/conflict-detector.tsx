'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Bot, Loader2 } from 'lucide-react';
import type { ProjectState, Task, Link } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type SerializableTask = Omit<Task, 'start' | 'finish' | 'constraintDate'> & {
    start: string;
    finish: string;
    constraintDate?: string | null;
}

const toSerializable = (tasks: Task[]): SerializableTask[] => {
    return tasks.map(t => ({
        ...t,
        start: t.start.toISOString(),
        finish: t.finish.toISOString(),
        constraintDate: t.constraintDate ? t.constraintDate.toISOString() : null
    }))
}

export function ConflictDetector({ projectState, projectId, dispatch, disabled }: { projectState: ProjectState, projectId?: string, dispatch: any, disabled?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [conflicts, setConflicts] = useState<{ taskId: string; conflictDescription: string; }[]>([]);
  const { toast } = useToast();

  const handleDetectConflicts = async () => {
    startTransition(async () => {
      const token = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('pocketbase_auth') ?? '{}')?.token ?? ''
        : '';

      const result = await fetch('/api/ai/conflicts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
          tasks: toSerializable(projectState.tasks),
          links: projectState.links,
        }),
      }).then(r => r.json());

      if (result.success && result.data) {
        if (result.data.length > 0) {
            setConflicts(result.data);
        } else {
            toast({
                title: "No Conflicts Found",
                description: "The AI analysis found no scheduling conflicts.",
            });
        }
      } else {
        toast({
          variant: 'destructive',
          title: "Error",
          description: result.error || "An unknown error occurred.",
        });
      }
    });
  };

  const applyConflicts = () => {
    dispatch({ type: 'SET_CONFLICTS', payload: conflicts });
    toast({
        title: "Conflicts Applied",
        description: `${conflicts.length} tasks have been marked with a scheduling conflict.`,
    });
    setConflicts([]);
  }

  return (
    <div className="p-2">
      <h3 className="text-sm font-semibold mb-2 px-2 text-muted-foreground">AI TOOLS</h3>
      <Button onClick={handleDetectConflicts} disabled={isPending || disabled} className="w-full justify-start gap-2">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
        Detect Conflicts
      </Button>

       <AlertDialog open={conflicts.length > 0} onOpenChange={() => setConflicts([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>AI Detected Conflicts</AlertDialogTitle>
            <AlertDialogDescription>
              The AI has identified the following potential scheduling conflicts. Review and apply the changes.
              <ul className="mt-4 list-disc pl-5 space-y-2 text-sm">
                {conflicts.map(c => {
                    const task = projectState.tasks.find(t => t.id === c.taskId);
                    return (
                        <li key={c.taskId}>
                           <span className="font-semibold">{task?.name || `Task ${c.taskId}`}:</span> {c.conflictDescription}
                        </li>
                    )
                })}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={applyConflicts}>Apply Flags</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
