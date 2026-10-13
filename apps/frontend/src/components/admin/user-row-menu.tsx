'use client';

import { useRef, useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ITEM =
  'flex min-h-11 w-full items-center rounded px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-accent focus-visible:bg-accent disabled:opacity-60';

export interface UserRowMenuItem {
  key: string;
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

// The "⋯" button of one user row. Same Popover pattern as OrgNodeMenu and
// CategoryMenu: Esc closes and returns focus, arrow keys move between items,
// and Radix keeps the panel inside the viewport. Renders nothing when the row
// has no actions, so a row never carries a button that opens an empty menu.
export function UserRowMenu({
  userName,
  items,
  triggerLabel = 'เมนูเพิ่มเติม',
}: Readonly<{ userName: string; items: UserRowMenuItem[]; triggerLabel?: string }>) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

  const focusables = () => [
    ...(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
  ];

  function onKeyDown(event: React.KeyboardEvent) {
    const all = focusables();
    const at = all.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => {
      event.preventDefault();
      all[(to + all.length) % all.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(at + 1);
    else if (event.key === 'ArrowUp') move(at < 0 ? all.length - 1 : at - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(all.length - 1);
  }

  const label = `การดำเนินการเพิ่มเติมของ ${userName}`;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          aria-haspopup="menu"
          aria-label={triggerLabel}
          title={triggerLabel}
        >
          <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={4}
          collisionPadding={8}
          avoidCollisions
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            focusables()[0]?.focus();
          }}
          className="z-50 max-h-[var(--radix-popover-content-available-height)] w-56 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <div ref={listRef} role="menu" aria-label={label} onKeyDown={onKeyDown}>
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={item.destructive ? `${ITEM} text-destructive` : ITEM}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
