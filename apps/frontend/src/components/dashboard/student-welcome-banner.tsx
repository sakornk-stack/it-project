import { GraduationCap, Sparkles } from 'lucide-react';

// The first block of the student dashboard: greeting, the one-line summary and
// the year level on the same fixed greens as the student top bar (white text in
// both light and dark mode). The circles are decoration only.
export function StudentWelcomeBanner({
  fullName,
  summary,
  yearLevel,
  isReady,
}: Readonly<{
  fullName: string;
  summary: string;
  yearLevel: number | null;
  isReady: boolean;
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
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-white/80">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
          <Sparkles size={13} aria-hidden="true" />
          ภาพรวมการเรียนของฉัน
        </span>
        {yearLevel !== null && yearLevel > 0 && (
          <span className="rounded-full bg-white/15 px-3 py-1">ชั้นปีที่ {yearLevel}</span>
        )}
      </div>
      <h1 className="mt-3 break-words text-[28px] font-semibold leading-tight md:text-3xl">
        สวัสดี, {fullName}
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/85">{summary}</p>
      {isReady && (
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-medium text-[#06554c]">
          <GraduationCap size={16} aria-hidden="true" />
          ยินดีด้วย! นิสิตพร้อมสำเร็จการศึกษา
        </p>
      )}
    </section>
  );
}
