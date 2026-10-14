export type OrgLevel = 'faculty' | 'department' | 'program' | 'curriculum';

// Which nodes must be open for a level's rows to be on screen: every ancestor of that level.
export function idsToExpandForLevel(
  level: OrgLevel,
  ids: Readonly<{
    faculties: readonly string[];
    departments: readonly string[];
    programs: readonly string[];
  }>,
): Set<string> {
  switch (level) {
    case 'faculty':
      return new Set();
    case 'department':
      return new Set(ids.faculties);
    case 'program':
      return new Set([...ids.faculties, ...ids.departments]);
    default:
      return new Set([...ids.faculties, ...ids.departments, ...ids.programs]);
  }
}

export interface TextPart {
  text: string;
  match: boolean;
}

// Splits `text` around every case-insensitive occurrence of `term`, for highlighting.
export function splitByTerm(text: string, term: string): TextPart[] {
  const needle = term.trim().toLowerCase();
  if (needle === '') return [{ text, match: false }];
  const lower = text.toLowerCase();
  const parts: TextPart[] = [];
  let from = 0;
  for (;;) {
    const at = lower.indexOf(needle, from);
    if (at === -1) break;
    if (at > from) parts.push({ text: text.slice(from, at), match: false });
    parts.push({ text: text.slice(at, at + needle.length), match: true });
    from = at + needle.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts.length > 0 ? parts : [{ text, match: false }];
}
