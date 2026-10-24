import { GraduationCap, Sparkles } from 'lucide-react';
import { WelcomeBanner } from './welcome-banner';

// The student dashboard's banner: greeting, the one-line summary and the year level.
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
  const chips = [
    <>
      <Sparkles size={13} aria-hidden="true" />
      ภาพรวมการเรียนของฉัน
    </>,
  ];
  if (yearLevel !== null && yearLevel > 0) chips.push(<>ชั้นปีที่ {yearLevel}</>);
  return (
    <WelcomeBanner chips={chips} title={`สวัสดี, ${fullName}`} summary={summary}>
      {isReady && (
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-medium text-[#06554c]">
          <GraduationCap size={16} aria-hidden="true" />
          ยินดีด้วย! นิสิตพร้อมสำเร็จการศึกษา
        </p>
      )}
    </WelcomeBanner>
  );
}
