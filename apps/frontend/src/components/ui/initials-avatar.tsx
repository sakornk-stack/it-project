import { cn } from '@/lib/utils';

const TITLES = ['นางสาว', 'นาย', 'นาง', 'น.ส.', 'ด.ช.', 'ด.ญ.', 'Mr.', 'Mrs.', 'Ms.', 'Miss'];
// Thai vowels written before the consonant they follow: the initial is the pair.
const LEADING_VOWELS = 'เแโใไ';

const graphemes = (text: string): string[] =>
  Array.from(new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(text), (s) => s.segment);

// The first letter of the given name, without a title in front of it.
export function initialOf(fullName: string): string {
  let name = fullName.trim();
  for (const title of TITLES) {
    if (name.startsWith(title)) {
      name = name.slice(title.length).trim();
      break;
    }
  }
  const [first, second] = graphemes(name);
  if (!first) return '?';
  return LEADING_VOWELS.includes(first) && second ? first + second : first.toUpperCase();
}

// A round plain tile with the initial, in the brand tint. Decoration: the name
// is always written next to it.
export function InitialsAvatar({
  name,
  className,
}: Readonly<{ name: string; className?: string }>) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-base font-semibold text-brand',
        className,
      )}
    >
      {initialOf(name)}
    </span>
  );
}
