// The surface every card on /profile shares: a thin border and two very soft stacked shadows.
// In dark mode the border turns into a faint light edge (foreground is the light colour there).
export const PROFILE_CARD_CLASS =
  'overflow-hidden border-border/70 shadow-[0_1px_2px_hsl(var(--foreground)/0.04),0_6px_20px_hsl(var(--foreground)/0.05)] dark:border-foreground/10 dark:shadow-[0_1px_2px_hsl(var(--background)/0.6)]';

// The icon tile used on profile rows: soft brand gradient with a hairline ring, and a very faint
// brand glow in dark mode only.
export const ICON_TILE_CLASS =
  'flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-light to-brand/15 text-brand ring-1 ring-inset ring-brand/15 dark:shadow-[0_0_14px_hsl(var(--brand)/0.2)]';
