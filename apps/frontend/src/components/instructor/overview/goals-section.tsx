import { Target } from 'lucide-react';
import { type CourseSnapshot, type GoalItem } from '@/lib/course-snapshot';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/ui/section-card';
import { LowSampleTag } from '../overview-parts';

// A code chip (mono) in a fixed narrow column, and the goal's words clamped to two
// lines so every row has the same height.
function GoalRow({ goal }: Readonly<{ goal: GoalItem }>) {
  return (
    <li className="flex min-h-16 items-center gap-3 py-3">
      <Badge tone="neutral" className="w-14 justify-center font-mono">
        {goal.code}
      </Badge>
      <p
        className="line-clamp-2 min-w-0 flex-1 break-words text-sm text-primary"
        title={goal.description}
      >
        {goal.description}
      </p>
    </li>
  );
}

// The goals of the course in code order. The backend has no share per goal, so
// nothing here is judged; the notes only say how much to trust the course share.
export function GoalsSection({ snapshot }: Readonly<{ snapshot: CourseSnapshot }>) {
  const { goals, level, stats } = snapshot;
  return (
    <SectionCard
      icon={Target}
      title="CLO ของวิชา"
      description="ผลลัพธ์การเรียนรู้รายวิชา: สิ่งที่นิสิตควรทำได้เมื่อเรียนจบวิชา"
      aside={level === 'low' ? <LowSampleTag counted={stats.graded} /> : undefined}
    >
      {goals.items.length === 0 ? (
        <EmptyState
          icon={Target}
          className="py-4"
          description="ยังไม่มี CLO ที่กำหนดไว้ในวิชานี้ เมื่อผู้ดูแลระบบกำหนดแล้ว จะแสดงที่นี่"
        />
      ) : (
        <ul className="-my-3 divide-y divide-slate-100">
          {goals.items.map((goal) => (
            <GoalRow key={goal.cloId} goal={goal} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
