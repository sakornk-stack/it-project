import { splitByTerm } from '@/lib/org-tree-view';

// `text` with every match of `term` marked. Plain text when there is no term.
export function HighlightText({ text, term }: Readonly<{ text: string; term: string }>) {
  const parts = splitByTerm(text, term);
  if (parts.length === 1 && !parts[0].match) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        part.match ? (
          <mark key={i} className="rounded-sm bg-amber-200 px-0.5 text-amber-900">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
