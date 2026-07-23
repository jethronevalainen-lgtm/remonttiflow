import * as React from "react"
import { cn } from "@/lib/utils"

export interface FieldProps {
  label?: string
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
  required?: boolean
}

export function Field({
  label,
  error,
  hint,
  children,
  className,
  required,
}: FieldProps) {
  const id = React.useId()
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      {React.isValidElement(children) &&
        React.cloneElement(children as React.ReactElement, { id })}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
