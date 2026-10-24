import type { ReactNode } from 'react';

// The first block of a home page on the top-bar look: small chips, the
// greeting (the page's h1), a one-line summary and optional actions, on the same
// fixed greens as the top bar (white text in both light and dark mode). The
// circles are decoration only.
export function WelcomeBanner({
  chips,
  title,
  summary,
  actions,
  children,
}: Readonly<{
  chips: ReactNode[];
  title: string;
  summary: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}>) {
  return (
    <section className="relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-[#053f39] via-[#06554c] to-[#0f8a74] px-6 py-7 text-white shadow-sm md:px-8 md:py-9">
      <span
        aria-hidden="true"
        className="absolute -right-10 -top-16 -z-10 h-56 w-56 rounded-full bg-white/10"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-20 right-24 -z-10 h-44 w-44 rounded-full bg-white/[0.06]"
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {chips.length > 0 && (
            <ul className="flex flex-wrap items-center gap-2 text-xs font-medium text-white/85">
              {chips.map((chip, i) => (
                <li
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1"
                >
                  {chip}
                </li>
              ))}
            </ul>
          )}
          <h1 className="mt-3 break-words text-[28px] font-semibold leading-tight md:text-3xl">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/85">{summary}</p>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

// Buttons that sit on the banner's green.
export const BANNER_PRIMARY_BUTTON =
  'min-h-11 gap-1.5 bg-white text-[#06554c] hover:bg-white/90 focus-visible:ring-white';
export const BANNER_SECONDARY_BUTTON =
  'min-h-11 gap-1.5 border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white focus-visible:ring-white';
