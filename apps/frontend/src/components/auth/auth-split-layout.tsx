import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { GraduationCap } from 'lucide-react';
import { BRAND_NAME } from '@/lib/brand';
import { PrivacyFooterLink } from '@/components/layout/privacy-footer-link';

// Shared shell for every sign-in page (/login, /register, /forgot-password,
// /reset-password, /register/google): a two-panel card (brand panel + form).
// Pages using this must not sit under a layout that narrows their width.
//
// The brand panel's height is set by CSS Grid stretch to match its
// sibling (the form column) — on /register that column is much taller
// than one screen, so the panel's own box is much taller than the
// viewport too. Centering content with justify-center alone only
// centers it within that oversized box, not within what's actually
// visible on screen — the content can end up anywhere from the top to
// the bottom of the viewport depending on scroll position. The fix is a
// `position: sticky` content wrapper that stays pinned at the vertical
// center of the actual viewport as the page scrolls, decoupled from the
// panel's own (possibly much taller) box.
//
// `top-[50vh]` (not `top-1/2`) is deliberate: a percentage `top` on a
// sticky/relative/absolute element resolves against its *containing
// block's* height — and the parent here is `position: relative`, so
// `top-1/2` would peg it to 50% of the panel's own (grid-stretched,
// possibly 1300px+ tall) box, not 50% of the viewport, silently
// reproducing the exact bug this is fixing. `vh` is a viewport-relative
// length, not a percentage, so it bypasses containing-block resolution
// entirely and always means "half the real viewport height." The
// `-translate-y-1/2` half-height pull-up is unaffected by this — transform
// percentages resolve against the element's own box, never the
// containing block.
//
// The panel is a plain block (no flex/justify-center) on purpose —
// sticky + translate alone already centers correctly in both the short
// (login) and tall (register) case; adding flexbox justify-content on
// top of a sticky child changes how its static position is computed and
// fights the sticky offset, producing an inconsistent rest position.
// Don't reintroduce it as a "fallback" without re-verifying both pages.
//
// `position: sticky` breaks if any ancestor between it and the viewport
// has `overflow` other than `visible` — the old version's outer grid
// container used `overflow-hidden` purely to clip the two children's
// square corners into the container's own rounded ones. That's removed
// here; each panel now rounds its own outer corners instead, and the
// brand panel's decorative background/icon gets its own *local*
// overflow-hidden layer (a sibling of the sticky content, not an
// ancestor of it), so clipping and sticky positioning don't conflict.
// md:min-h-[34rem]: in a short panel the sticky content is clamped at the
// panel bottom and then pulled up by half its own height, so its top gap
// is roughly panelHeight - 1.5 x contentHeight (~326px desktop, ~349px at
// 768px). Forgot-password's single-field form alone gave a 334px card and
// the heading overhung the top. 34rem gives about login's own gaps, and
// is just under login's natural 550px, so login/register don't change.
// title/description are required (no default copy here) so each page owns
// its brand-panel message and a new page can't silently inherit another's.
function BrandMark({ className }: Readonly<{ className?: string }>) {
  return (
    <div className={className}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
        <GraduationCap size={18} className="text-brand-light" aria-hidden="true" />
      </div>
      <span className="text-base font-semibold text-primary">{BRAND_NAME}</span>
    </div>
  );
}

// The page's own h1 lives in the form column (see AuthHeading) so it exists on
// phones too; the brand panel's message is a plain paragraph.
export function AuthSplitLayout({
  title,
  description,
  children,
}: Readonly<{ title: ReactNode; description: ReactNode; children: ReactNode }>) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 pt-16 md:pt-4">
      <ThemeToggle className="fixed right-4 top-4 z-30" />
      <div className="w-full max-w-5xl">
        <BrandMark className="mb-4 flex items-center justify-center gap-2 md:hidden" />
        <div className="grid grid-cols-1 rounded-2xl border border-border bg-card shadow-card md:min-h-[34rem] md:grid-cols-[5fr_6fr]">
          <div className="relative hidden md:block">
            <div className="absolute inset-0 overflow-hidden rounded-l-2xl border-r border-border bg-brand-light">
              <GraduationCap
                size={280}
                strokeWidth={1}
                className="absolute -right-12 -top-12 text-brand/[0.07]"
                aria-hidden="true"
              />
              <GraduationCap
                size={160}
                strokeWidth={1}
                className="absolute -bottom-8 left-8 text-brand/[0.07]"
                aria-hidden="true"
              />
            </div>
            <div className="sticky top-[50vh] z-10 -translate-y-1/2 p-10 lg:p-12">
              <BrandMark className="mb-8 flex items-center gap-2" />
              <p className="mb-4 text-[1.625rem] font-semibold leading-snug tracking-tight text-primary">{title}</p>
              <p className="mb-8 max-w-sm text-sm leading-7 text-primary/75">{description}</p>
              <div className="flex gap-2">
                <span className="h-1 w-6 rounded-full bg-brand" />
                <span className="h-1 w-2 rounded-full bg-brand/40" />
                <span className="h-1 w-2 rounded-full bg-brand/40" />
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-center rounded-2xl p-6 sm:p-10 md:rounded-l-none md:rounded-r-2xl lg:px-14">
            {children}
          </div>
        </div>
        <PrivacyFooterLink className="mt-2" />
      </div>
    </div>
  );
}
