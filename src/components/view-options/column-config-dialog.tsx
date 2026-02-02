'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from 'react';
import type { ColumnSpec } from "@/lib/types";

export type ColumnConfig = Omit<ColumnSpec, 'id' | 'width'>;

export function ColumnConfigDialog({
    open,
    onOpenChange,
    onSave,
    column,
} : {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    onSave: (config: ColumnConfig) => void,
    column?: Omit<ColumnSpec, 'width'> | null
}) {
    const [name, setName] = useState('');
    const [type, setType] = useState<ColumnSpec['type']>('text');
    const [options, setOptions] = useState('');

    useEffect(() => {
        if (open && column) {
            setName(column.name);
            setType(column.type || 'text');
            setOptions(column.options?.join('\n') || '');
        } else if (open) {
            // Reset for new column
            setName('');
            setType('text');
            setOptions('');
        }
    }, [open, column]);

    const handleSave = () => {
        const finalOptions = type === 'selection' ? options.split('\n').map(o => o.trim()).filter(Boolean) : undefined;
        // The onSave prop is now responsible for closing the dialog
        onSave({ name, type, options: finalOptions });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{column ? 'Edit Column' : 'Add New Column'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name</Label>
                        <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="type" className="text-right">Type</Label>
                        <Select value={type} onValueChange={(v: ColumnSpec['type']) => v && setType(v)}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select a type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="selection">Selection</SelectItem>
                                <SelectItem value="date">Date</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {type === 'selection' && (
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="options" className="text-right">Options</Label>
                            <Textarea
                                id="options"
                                value={options}
                                onChange={e => setOptions(e.target.value)}
                                className="col-span-3"
                                placeholder="Enter one option per line"
                            />
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Cancel</Button>
                    </DialogClose>
                    <Button type="button" onClick={handleSave} disabled={!name.trim()}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
