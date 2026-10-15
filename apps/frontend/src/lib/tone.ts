// One vocabulary for every status surface in the app, named for what a
// tone MEANS rather than what colour it currently is — the colours move
// when the theme does, the meanings do not.
export type SemanticTone = 'success' | 'warning' | 'danger' | 'neutral';

// Every place a tone becomes a colour lives in this file, so a palette
// change is one edit here instead of a hunt through five components.
//
// The four recipes below are deliberately NOT identical. A badge is a
// small inline pill, a toast is a larger surface laid over content (so it
// carries a darker label and a lighter neutral fill), and a chart bar is
// a solid block that has to read at a glance. Keeping them side by side
// makes those differences a visible decision rather than a discrepancy.

export const BADGE_TONE_CLASSES: Record<SemanticTone, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
};

// A soft background alone, for tinting a table cell or a row by meaning.
export const TINT_TONE_CLASSES: Record<SemanticTone, string> = {
  success: 'bg-emerald-50',
  warning: 'bg-amber-50',
  danger: 'bg-red-50',
  neutral: 'bg-slate-50',
};

// Text colour alone, for a short remark beside a figure (e.g. highest / lowest).
export const TEXT_TONE_CLASSES: Record<SemanticTone, string> = {
  success: 'text-emerald-700',
  warning: 'text-amber-700',
  danger: 'text-red-700',
  neutral: 'text-slate-600',
};

export const BAR_TONE_CLASSES: Record<SemanticTone, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  neutral: 'bg-slate-300',
};

// A thin left edge on a row or card that marks its meaning (warning/danger rows).
export const ACCENT_TONE_CLASSES: Record<SemanticTone, string> = {
  success: 'border-l-emerald-500',
  warning: 'border-l-amber-500',
  danger: 'border-l-red-500',
  neutral: 'border-l-slate-200',
};

// Toasts never surface a warning today; `toast.error()` maps onto danger
// and `toast.info()` onto neutral.
export type ToastTone = Extract<SemanticTone, 'success' | 'danger' | 'neutral'>;

export const TOAST_TONE_CLASSES: Record<ToastTone, string> = {
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  danger: 'bg-red-50 text-red-800 border-red-200',
  neutral: 'bg-slate-50 text-slate-700 border-slate-200',
};

export const TOAST_ICON_CLASSES: Record<ToastTone, string> = {
  success: 'text-emerald-600',
  danger: 'text-red-600',
  neutral: 'text-slate-500',
};
