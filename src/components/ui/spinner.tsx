import * as React from "react"
import { cn } from "@/lib/utils"

export interface SpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-8 w-8 border-[3px]",
  }

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-solid border-current border-t-transparent",
        sizeClasses[size],
        className
      )}
    />
  )
}
