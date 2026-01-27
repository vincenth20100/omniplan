import * as React from "react"
import { cn } from "@/lib/utils"

export function Kbd({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted border rounded-md shadow-sm",
        className
      )}
      {...props}
    />
  )
}
