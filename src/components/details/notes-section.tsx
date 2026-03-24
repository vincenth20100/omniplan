'use client';

import type { Task, Note } from '@/lib/types';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Paperclip, Send, Pencil, Trash2, X, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Label } from '@/components/ui/label';
import type { AppUser as User } from '@/types/auth';

export function NotesSection({ task, dispatch, user }: { task: Task; dispatch: any, user: User }) {
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

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

  const startEditing = (note: Note) => {
      setEditingNoteId(note.id);
      setEditContent(note.content);
  };

  const cancelEditing = () => {
      setEditingNoteId(null);
      setEditContent('');
  };

  const saveEdit = (noteId: string) => {
      if (editContent.trim()) {
          dispatch({
              type: 'UPDATE_NOTE',
              payload: { taskId: task.id, noteId, content: editContent }
          });
          setEditingNoteId(null);
      }
  };

  const deleteNote = (noteId: string) => {
       if (confirm("Are you sure you want to delete this note?")) {
           dispatch({
               type: 'DELETE_NOTE',
               payload: { taskId: task.id, noteId }
           });
       }
  };

  const displayNotes = [...(task.notes || [])].reverse();
  
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
          {displayNotes.map((note, index) => {
            const isLatest = index === 0;
            const isOwner = note.userId === user.id;
            const canEdit = isLatest && isOwner;
            const isEditing = editingNoteId === note.id;

            return (
                <div key={note.id} className="flex gap-3 group">
                  <Avatar className="h-8 w-8 mt-1">
                    <AvatarFallback>{note.author.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{note.author}</span>
                            <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(note.timestamp), { addSuffix: true })}
                            </span>
                        </div>
                        {canEdit && !isEditing && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEditing(note)}>
                                    <Pencil className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deleteNote(note.id)}>
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {isEditing ? (
                        <div className="mt-1">
                            <Textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="min-h-[60px] mb-2"
                            />
                            <div className="flex gap-2 justify-end">
                                <Button size="sm" variant="ghost" onClick={cancelEditing}>
                                    <X className="h-4 w-4 mr-1" /> Cancel
                                </Button>
                                <Button size="sm" onClick={() => saveEdit(note.id)}>
                                    <Check className="h-4 w-4 mr-1" /> Save
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    )}
                  </div>
                </div>
            );
          })}
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
