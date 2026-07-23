import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonGroupVariants = cva("inline-flex items-center", {
  variants: {
    variant: {
      default: "divide-x divide-primary-foreground/20",
      outline: "divide-x divide-border rounded-md border",
      ghost: "divide-x divide-border",
    },
    size: {
      default: "",
      sm: "",
      lg: "",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
})

export interface ButtonGroupProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof buttonGroupVariants> {
  asChild?: boolean
}

const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div"
    return (
      <Comp
        className={cn(buttonGroupVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
ButtonGroup.displayName = "ButtonGroup"

export { ButtonGroup, buttonGroupVariants }
