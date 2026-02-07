'use client';

import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useThemeContext } from './theme-context';
import { Button } from "@/components/ui/button";
import { Palette, Type, Box } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StyleEditorPopoverProps {
    elementId: string;
    children: React.ReactNode;
}

export function StyleEditorPopover({ elementId, children }: StyleEditorPopoverProps) {
    const { elementStyles, updateElementStyle, isCustomizing } = useThemeContext();
    const style = elementStyles[elementId] || {};

    const handleStyleChange = (property: string, value: string) => {
        updateElementStyle(elementId, { [property]: value });
    };

    if (!isCustomizing) {
        return <>{children}</>;
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent className="w-80 z-50" side="right" align="start">
                <div className="grid gap-4">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Style Editor</h4>
                        <p className="text-sm text-muted-foreground">
                            Customize appearance for this element.
                        </p>
                    </div>
                    <Tabs defaultValue="colors">
                        <TabsList className="w-full">
                            <TabsTrigger value="colors" className="flex-1"><Palette className="w-4 h-4 mr-2"/> Colors</TabsTrigger>
                            <TabsTrigger value="layout" className="flex-1"><Box className="w-4 h-4 mr-2"/> Layout</TabsTrigger>
                            <TabsTrigger value="text" className="flex-1"><Type className="w-4 h-4 mr-2"/> Text</TabsTrigger>
                        </TabsList>
                        <TabsContent value="colors" className="space-y-4">
                            <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="bgColor">Background</Label>
                                <div className="col-span-2 flex gap-2">
                                    <Input
                                        id="bgColorPicker"
                                        type="color"
                                        className="w-8 h-8 p-0 border-0"
                                        value={style.backgroundColor as string || '#ffffff'}
                                        onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                                    />
                                    <Input
                                        id="bgColor"
                                        className="h-8 flex-1"
                                        value={style.backgroundColor as string || ''}
                                        onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                                        placeholder="Color value"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="textColor">Text Color</Label>
                                <div className="col-span-2 flex gap-2">
                                    <Input
                                        id="textColorPicker"
                                        type="color"
                                        className="w-8 h-8 p-0 border-0"
                                        value={style.color as string || '#000000'}
                                        onChange={(e) => handleStyleChange('color', e.target.value)}
                                    />
                                    <Input
                                        id="textColor"
                                        className="h-8 flex-1"
                                        value={style.color as string || ''}
                                        onChange={(e) => handleStyleChange('color', e.target.value)}
                                        placeholder="Color value"
                                    />
                                </div>
                            </div>
                        </TabsContent>
                         <TabsContent value="layout" className="space-y-4">
                            <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="borderRadius">Radius</Label>
                                <Input
                                    id="borderRadius"
                                    className="col-span-2 h-8"
                                    placeholder="e.g. 4px"
                                    value={style.borderRadius as string || ''}
                                    onChange={(e) => handleStyleChange('borderRadius', e.target.value)}
                                />
                            </div>
                             <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="padding">Padding</Label>
                                <Input
                                    id="padding"
                                    className="col-span-2 h-8"
                                    placeholder="e.g. 8px"
                                    value={style.padding as string || ''}
                                    onChange={(e) => handleStyleChange('padding', e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="margin">Margin</Label>
                                <Input
                                    id="margin"
                                    className="col-span-2 h-8"
                                    placeholder="e.g. 8px"
                                    value={style.margin as string || ''}
                                    onChange={(e) => handleStyleChange('margin', e.target.value)}
                                />
                            </div>
                        </TabsContent>
                        <TabsContent value="text" className="space-y-4">
                             <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="fontSize">Size</Label>
                                <Input
                                    id="fontSize"
                                    className="col-span-2 h-8"
                                    placeholder="e.g. 14px"
                                    value={style.fontSize as string || ''}
                                    onChange={(e) => handleStyleChange('fontSize', e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="fontWeight">Weight</Label>
                                <Input
                                    id="fontWeight"
                                    className="col-span-2 h-8"
                                    placeholder="e.g. bold, 500"
                                    value={style.fontWeight as string || ''}
                                    onChange={(e) => handleStyleChange('fontWeight', e.target.value)}
                                />
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </PopoverContent>
        </Popover>
    );
}
