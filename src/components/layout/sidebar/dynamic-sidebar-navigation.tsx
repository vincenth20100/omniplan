'use client';

import React, { useState } from 'react';
import {
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarGroupContent,
    SidebarSeparator
} from "@/components/ui/sidebar";
import * as Icons from 'lucide-react';
import { useThemeContext } from '@/components/theme/theme-context';
import { SidebarView } from './project-sidebar';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SidebarItem } from '@/lib/theme-types';
import { StyleEditorPopover } from '@/components/theme/style-editor-popover';

// Icon Helper
const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
    // @ts-ignore
    const Icon = Icons[name];
    if (!Icon) return null;
    return <Icon className={className} />;
};

interface SortableSidebarItemProps {
    item: SidebarItem;
    isActive: boolean;
    onClick: (e: any) => void;
    isCustomizing: boolean;
    enableHover: boolean;
    styleOverride?: React.CSSProperties;
    isHorizontal: boolean;
}

// Sortable Item Component
function SortableSidebarItem({ item, isActive, onClick, isCustomizing, enableHover, styleOverride, isHorizontal }: SortableSidebarItemProps) {
    const { elementStyles } = useThemeContext();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id, disabled: !isCustomizing, data: { type: 'item', item } });

    const userStyle = elementStyles[item.id] || {};

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        ...styleOverride
    };

    const content = (
        <SidebarMenuButton
            onClick={isCustomizing ? (e) => e.preventDefault() : onClick}
            className={cn(
                isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "",
                enableHover && !isCustomizing ? "hover:scale-110 transition-transform origin-left" : "",
                isCustomizing ? "cursor-move border border-transparent hover:border-dashed hover:border-sidebar-foreground/50" : "",
                isHorizontal ? "w-auto px-2 justify-center shrink-0" : ""
            )}
            tooltip={isCustomizing ? undefined : item.label}
            style={userStyle}
        >
            <DynamicIcon name={item.icon} />
            <span>{item.label}</span>
        </SidebarMenuButton>
    );

    return (
        <SidebarMenuItem ref={setNodeRef} style={style} {...attributes} {...listeners}>
            {isCustomizing ? (
                <StyleEditorPopover elementId={item.id}>
                    {content}
                </StyleEditorPopover>
            ) : (
                content
            )}
        </SidebarMenuItem>
    );
}

export function DynamicSidebarNavigation({
    onNavigate,
    dispatch,
    currentView
}: {
    onNavigate: (view: SidebarView) => void;
    dispatch: any;
    currentView?: SidebarView;
}) {
    const { sidebarConfig, setSidebarConfig, isCustomizing, layoutConfig, elementStyles } = useThemeContext();
    const { sidebarPosition, enableMacOsHover } = layoutConfig;

    const isHorizontal = sidebarPosition === 'top' || sidebarPosition === 'bottom';
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeItem, setActiveItem] = useState<SidebarItem | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const findContainer = (id: string) => {
        // If the id is a group id, return it
        if (sidebarConfig.find(g => g.id === id)) return id;

        // If the id is an item id, return the group id
        const group = sidebarConfig.find(g => g.items.find(i => i.id === id));
        if (group) return group.id;

        return null;
    };

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id as string);
        const item = active.data.current?.item;
        if(item) setActiveItem(item);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeContainerId = findContainer(active.id as string);
        const overContainerId = findContainer(over.id as string);

        if (!activeContainerId || !overContainerId || activeContainerId === overContainerId) {
            return;
        }

        // Cross-group dragging logic
        const activeGroup = sidebarConfig.find(g => g.id === activeContainerId);
        const overGroup = sidebarConfig.find(g => g.id === overContainerId);

        if (!activeGroup || !overGroup) return;

        const activeItems = activeGroup.items;
        const overItems = overGroup.items;

        const activeIndex = activeItems.findIndex(i => i.id === active.id);
        const overIndex = overItems.findIndex(i => i.id === over.id);

        let newIndex;
        if (over.data.current?.type === 'group') {
            newIndex = overItems.length + 1;
        } else {
            const isBelowOverItem = over &&
              active.rect.current.translated &&
              active.rect.current.translated.top > over.rect.top + over.rect.height;

            const modifier = isBelowOverItem ? 1 : 0;
            newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
        }

        // Ensure newIndex is within bounds
        if (newIndex > overItems.length) newIndex = overItems.length;

        const newConfig = sidebarConfig.map(group => {
            if (group.id === activeContainerId) {
                return {
                    ...group,
                    items: group.items.filter(i => i.id !== active.id)
                };
            }
            if (group.id === overContainerId) {
                 const newGroupItems = [...group.items];
                 const itemToMove = activeGroup.items[activeIndex];
                 // Insert
                 if (itemToMove) {
                     newGroupItems.splice(newIndex, 0, itemToMove);
                 }
                 return {
                     ...group,
                     items: newGroupItems
                 };
            }
            return group;
        });

        setSidebarConfig(newConfig);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveItem(null);

        if (!over) return;

        const activeContainerId = findContainer(active.id as string);
        const overContainerId = findContainer(over.id as string);

        if (activeContainerId && overContainerId && activeContainerId === overContainerId) {
            const groupIndex = sidebarConfig.findIndex(g => g.id === activeContainerId);
            if (groupIndex === -1) return;

            const group = sidebarConfig[groupIndex];
            const oldIndex = group.items.findIndex(i => i.id === active.id);
            const newIndex = group.items.findIndex(i => i.id === over.id);

            if (oldIndex !== newIndex) {
                 const newConfig = [...sidebarConfig];
                 const newItems = arrayMove(group.items, oldIndex, newIndex);
                 newConfig[groupIndex] = {
                     ...group,
                     items: newItems
                 };
                 setSidebarConfig(newConfig);
            }
        }
    };

    // Helper to execute action
    const handleAction = (item: any) => {
        if (item.disabled) return;

        if (item.action.startsWith('navigate:')) {
            onNavigate(item.action.split(':')[1] as SidebarView);
        } else if (item.action.startsWith('dispatch:')) {
            const type = item.action.split(':')[1];
            const payload = item.params?.generateId ? { id: crypto.randomUUID() } : item.params;
            dispatch({ type, payload });
        }
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className={cn("flex gap-0", isHorizontal ? "flex-row items-center h-full overflow-x-auto" : "flex-col")}>
                {sidebarConfig.map((group, index) => {
                    const groupLabelContent = (
                        <SidebarGroupLabel style={elementStyles[group.id] || {}}>
                            {group.label}
                        </SidebarGroupLabel>
                    );

                    return (
                    <React.Fragment key={group.id}>
                        {index > 0 && <SidebarSeparator className={isHorizontal ? "mx-2 h-6 w-[1px]" : ""} />}
                        <SidebarGroup className={isHorizontal ? "p-0 w-auto" : ""}>
                            {group.showLabel && !isHorizontal && (
                                isCustomizing ? (
                                    <StyleEditorPopover elementId={group.id}>
                                        <div className="cursor-pointer hover:bg-sidebar-accent/50 rounded">
                                            {groupLabelContent}
                                        </div>
                                    </StyleEditorPopover>
                                ) : groupLabelContent
                            )}
                            <SidebarGroupContent>
                                <SidebarMenu className={isHorizontal ? "flex-row gap-2" : ""}>
                                    <SortableContext
                                        items={group.items.map(i => i.id)}
                                        strategy={isHorizontal ? horizontalListSortingStrategy : verticalListSortingStrategy}
                                    >
                                        {group.items.map(item => (
                                            <SortableSidebarItem
                                                key={item.id}
                                                item={item}
                                                isActive={false}
                                                onClick={() => handleAction(item)}
                                                isCustomizing={isCustomizing}
                                                enableHover={enableMacOsHover}
                                                isHorizontal={isHorizontal}
                                            />
                                        ))}
                                    </SortableContext>
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    </React.Fragment>
                )})}
            </div>
            <DragOverlay>
                {activeItem ? (
                     <SidebarMenuButton className="bg-sidebar-accent text-sidebar-accent-foreground">
                        <DynamicIcon name={activeItem.icon} />
                        <span>{activeItem.label}</span>
                     </SidebarMenuButton>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
