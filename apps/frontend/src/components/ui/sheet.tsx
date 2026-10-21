import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

// Off-canvas drawer built on Radix Dialog — reused wherever a fixed sidebar
// needs a mobile/tablet fallback (currently just DashboardShell). No
// SheetTrigger subcomponent: the caller (DashboardShell) controls `open`
// state itself via its own hamburger button, which is simpler than wiring
// a Radix trigger for a single call site.
const Sheet = DialogPrimitive.Root;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-40 bg-black/40 duration-200 ease-in-out motion-reduce:!animate-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: 'left' | 'right';
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ className, side = 'left', children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed inset-y-0 z-50 flex w-72 flex-col bg-background p-6 shadow-lg outline-none duration-200 ease-in-out motion-reduce:!animate-none data-[state=open]:animate-in data-[state=closed]:animate-out',
        side === 'left'
          ? 'left-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left'
          : 'right-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
        className,
      )}
      {...props}
    >
      {/* Radix requires an accessible title; visually hidden since the
          drawer's own nav content already announces its purpose. */}
      <DialogPrimitive.Title className="sr-only">เมนู</DialogPrimitive.Title>
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = DialogPrimitive.Content.displayName;

export { Sheet, SheetContent };
