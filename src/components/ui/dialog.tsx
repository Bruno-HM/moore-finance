import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

const DialogContext = React.createContext<{
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} | null>(null);

const Dialog = ({ open, onOpenChange, children }: { open?: boolean, onOpenChange?: (open: boolean) => void, children?: React.ReactNode }) => {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
};

const DialogTrigger = ({ children, asChild }: { children: React.ReactNode, asChild?: boolean }) => {
  const context = React.useContext(DialogContext);
  if (!context) return null;

  const child = React.Children.only(children) as React.ReactElement;

  return React.cloneElement(child, { 
    onClick: (e: React.MouseEvent) => {
      context.onOpenChange?.(true);
      if (child.props.onClick) child.props.onClick(e);
    }
  });
};

const DialogContent = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  const context = React.useContext(DialogContext);
  if (!context?.open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 touch-none pointer-events-none">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 pointer-events-auto" 
        onClick={() => context.onOpenChange?.(false)} 
      />
      <div className={cn(
        "relative z-[101] w-full max-w-lg bg-popover shadow-2xl border animate-in zoom-in-95 duration-200 pointer-events-auto",
        "flex flex-col",
        "max-h-[100dvh] sm:max-h-[90vh]", // Use Dynamic Viewport Height
        "rounded-t-[2.5rem] sm:rounded-2xl", // Bottom sheet look on mobile
        className
      )}>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 rounded-full opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none z-50 bg-black/50 backdrop-blur"
          onClick={() => context.onOpenChange?.(false)}
        >
          <XIcon className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
        {children}
      </div>
    </div>,
    document.body
  );
};

const DialogHeader = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  return <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}>{children}</div>;
};

const DialogTitle = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  return <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)}>{children}</h2>;
};

const DialogDescription = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  return <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>;
};

const DialogFooter = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  return <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}>{children}</div>;
};

const DialogClose = ({ children, onClick }: { children: React.ReactNode, onClick?: () => void }) => {
  return React.cloneElement(children as React.ReactElement, { onClick });
};

const DialogPortal = ({ children }: { children: React.ReactNode }) => <>{children}</>;
const DialogOverlay = ({ className }: { className?: string }) => null;

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogPortal,
  DialogOverlay,
}

