'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Kbd } from "@/components/ui/kbd";

const shortcuts = [
  // General
  { combination: [["Ctrl", "Cmd"], "+", ["B"]], description: "Toggle sidebar visibility" },
  { combination: [["Ctrl", "Cmd"], "+", ["Z"]], description: "Undo last action" },
  { combination: [["Ctrl", "Cmd"], "+", ["Y"]], description: "Redo last action" },
  
  // Navigation & Selection
  { combination: [["Arrow Keys"]], description: "Navigate between cells" },
  { combination: [["Shift"], "+", ["Arrow Up/Down"]], description: "Select multiple rows" },

  // Editing
  { combination: [["Insert"]], description: "Add a new task below the selected row" },
  { combination: [["F2"]], description: "Edit selected cell without clearing content" },
  { combination: [["Enter"]], description: "Confirm cell edit" },
  { combination: [["Escape"]], description: "Cancel cell edit" },
  { combination: [["Any character"]], description: "Start editing cell, replacing content" },
  { combination: [["Backspace"]], description: "Start editing cell, clearing content" },

  // Hierarchy
  { combination: [["Ctrl", "Cmd"], "+", ["Shift"], "+", ["→"]], description: "Indent selected task(s)" },
  { combination: [["Ctrl", "Cmd"], "+", ["Shift"], "+", ["←"]], description: "Outdent selected task(s)" },
];


export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Boost your productivity with these keyboard shortcuts.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key(s)</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shortcuts.map((shortcut, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      {shortcut.combination.map((part, partIndex) => {
                        if (Array.isArray(part)) {
                          return part.map((key, keyIndex) => (
                            <React.Fragment key={key}>
                              <Kbd>{key}</Kbd>
                              {keyIndex < part.length - 1 && <span className="mx-1">/</span>}
                            </React.Fragment>
                          ));
                        }
                        return <span key={partIndex}>{part}</span>;
                      })}
                    </span>
                  </TableCell>
                  <TableCell>{shortcut.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
