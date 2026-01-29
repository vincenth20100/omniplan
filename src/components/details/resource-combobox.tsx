'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import type { Resource } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

// This is the content for a Popover, designed to be placed inside a PopoverContent.
export function ResourceComboboxContent({
  allResources,
  excludedResourceIds,
  onSelectResource,
  searchPlaceholder = "Search by name or initials...",
}: {
  allResources: Resource[];
  excludedResourceIds: string[];
  onSelectResource: (resourceId: string) => void;
  searchPlaceholder?: string;
}) {
  const [search, setSearch] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Focus the input when the component mounts
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const availableResources = allResources.filter(
    (r) =>
      !excludedResourceIds.includes(r.id) &&
      (r.name.toLowerCase().includes(search.toLowerCase()) ||
       r.initials?.toLowerCase().includes(search.toLowerCase()))
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === 'Tab') && availableResources.length > 0) {
      e.preventDefault();
      onSelectResource(availableResources[0].id);
    }
  };

  return (
    <>
      <div className="p-2 border-b">
        <Input
          ref={inputRef}
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8"
        />
      </div>
      <ScrollArea className="h-[200px]">
        <div className="p-1">
          {availableResources.length > 0 ? (
            availableResources.map((resource) => (
              <div
                key={resource.id}
                onMouseDown={(e) => e.preventDefault()} // Prevent input from blurring on click
                onClick={() => onSelectResource(resource.id)}
                className="p-2 rounded-md hover:bg-accent cursor-pointer text-sm"
              >
                {resource.name} {resource.initials && `(${resource.initials})`}
              </div>
            ))
          ) : (
            <div className="p-2 text-center text-sm text-muted-foreground">
              No resources found.
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );
}
