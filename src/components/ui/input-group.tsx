import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputGroupProps {
  children: React.ReactNode
  className?: string
}

export function InputGroup({ children, className }: InputGroupProps) {
  return (
    <div
      className={cn(
        "flex rounded-md shadow-sm -space-x-px",
        className
      )}
    >
      {children}
    </div>
  )
}

export interface InputGroupTextProps {
  children: React.ReactNode
  className?: string
  position?: "start" | "end"
}

export function InputGroupText({
  children,
  className,
  position = "start",
}: InputGroupTextProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-3 text-sm text-muted-foreground bg-muted border border-input",
        position === "start" ? "rounded-l-md" : "rounded-r-md",
        className
      )}
    >
      {children}
    </span>
  )
}
