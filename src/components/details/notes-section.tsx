'use client';

import type { Task, Note } from '@/lib/types';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Paperclip, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Label } from '@/components/ui/label';

export function NotesSection({ task, dispatch }: { task: Task; dispatch: any }) {
  const [newNote, setNewNote] = useState('');

  const handleAddNote = () => {
    if (newNote.trim()) {
      dispatch({
        type: 'ADD_NOTE_TO_TASK',
        payload: {
          taskId: task.id,
          content: newNote,
        },
      });
      setNewNote('');
    }
  };
  
  return (
    <div className="flex flex-col h-full gap-6">
      <div>
          <Label htmlFor="additional-notes" className="text-xs font-semibold text-muted-foreground uppercase">
              Additional Information
          </Label>
          <Textarea
              id="additional-notes"
              value={task.additionalNotes || ''}
              onChange={(e) => dispatch({ type: 'UPDATE_TASK', payload: { id: task.id, additionalNotes: e.target.value } })}
              placeholder="Add any persistent, high-level information about this task here..."
              className="mt-2"
              rows={5}
          />
      </div>
      <div className="flex-grow flex flex-col gap-2 overflow-hidden">
        <Label className="text-xs font-semibold text-muted-foreground shrink-0">ACTIVITY LOG</Label>
        
        <div className="flex-grow overflow-y-auto pr-2 space-y-4">
          {(task.notes || []).map(note => (
            <div key={note.id} className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{note.author.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-grow">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{note.author}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(note.timestamp), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-4 border-t shrink-0">
          <div className="relative">
            <Textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Add a log entry..."
              className="pr-24"
              rows={2}
            />
            <div className="absolute right-2 bottom-2 flex gap-1">
              <Button variant="ghost" size="icon" disabled>
                  <Paperclip className="h-4 w-4" />
                  <span className="sr-only">Attach file</span>
              </Button>
              <Button size="icon" onClick={handleAddNote} disabled={!newNote.trim()}>
                <Send className="h-4 w-4" />
                <span className="sr-only">Send</span>
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Attachments are not yet supported.</p>
        </div>
      </div>
    </div>
  );
}
