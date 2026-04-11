import * as React from "react"
import { cn } from "@/lib/utils"

const Switch = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { checked?: boolean, onCheckedChange?: (checked: boolean) => void, size?: "sm" | "default" }>(
  ({ className, checked, onCheckedChange, size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
          size === "default" ? "h-6 w-11" : "h-4 w-7",
          className
        )}
        data-state={checked ? "checked" : "unchecked"}
        {...props}
      >
        <span
          className={cn(
            "pointer-events-none block rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
            size === "default" ? "h-5 w-5" : "h-3 w-3"
          )}
          data-state={checked ? "checked" : "unchecked"}
        />
      </button>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }

