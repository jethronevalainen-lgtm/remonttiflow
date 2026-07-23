import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const itemVariants = cva(
  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
  {
    variants: {
      variant: {
        default: "hover:bg-accent hover:text-accent-foreground",
        active: "bg-accent text-accent-foreground font-medium",
        subtle: "hover:bg-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface ItemProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof itemVariants> {
  asChild?: boolean
}

const Item = React.forwardRef<HTMLDivElement, ItemProps>(
  ({ className, variant, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div"
    return (
      <Comp
        className={cn(itemVariants({ variant, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Item.displayName = "Item"

export { Item, itemVariants }
