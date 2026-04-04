import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const TabsContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
  variant?: "default" | "line";
} | null>(null);

const Tabs = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value?: string, onValueChange?: (value: string) => void, defaultValue?: string }>(
  ({ className, value: controlledValue, onValueChange, defaultValue, children, ...props }, ref) => {
    const [value, setValue] = React.useState(controlledValue || defaultValue);

    React.useEffect(() => {
      if (controlledValue !== undefined) {
        setValue(controlledValue);
      }
    }, [controlledValue]);

    const handleValueChange = React.useCallback((newValue: string) => {
      if (controlledValue === undefined) {
        setValue(newValue);
      }
      onValueChange?.(newValue);
    }, [controlledValue, onValueChange]);

    return (
      <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
        <div
          ref={ref}
          className={cn("flex flex-col gap-2", className)}
          {...props}
        >
          {children}
        </div>
      </TabsContext.Provider>
    )
  }
)
Tabs.displayName = "Tabs"

const tabsListVariants = cva(
  "inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground h-9",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent border-b rounded-none p-0 h-auto",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof tabsListVariants>>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(tabsListVariants({ variant }), className)}
        {...props}
      >
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<any>, { variant });
          }
          return child;
        })}
      </div>
    )
  }
)
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string, variant?: "default" | "line" }>(
  ({ className, value, variant, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    const isActive = context?.value === value;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        onClick={() => context?.onValueChange?.(value)}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          variant === "default" && isActive && "bg-background text-foreground shadow-sm",
          variant === "line" && "rounded-none border-b-2 border-transparent px-4 py-2",
          variant === "line" && isActive && "border-primary text-foreground",
          !isActive && "text-muted-foreground hover:text-foreground",
          className
        )}
        {...props}
      />
    )
  }
)
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value: string }>(
  ({ className, value, children, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    const isActive = context?.value === value;

    if (!isActive) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        className={cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
