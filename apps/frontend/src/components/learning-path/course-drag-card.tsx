import type { DragEvent } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import type { AvailableCourse } from '@eduanalyze-ai/shared-types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const GHOST_TILT_DEG = -3;
const GHOST_PAD_PX = 16;

// Replaces the browser's flat drag snapshot with a slightly tilted copy of the
// card plus a soft shadow. Purely cosmetic: the copy is a throwaway node that
// only exists so the browser can snapshot it, and it is removed straight away.
// If anything here throws, the browser falls back to its default preview and
// the drag itself is unaffected. The shadow uses a theme token so it reads in
// dark mode; under reduced motion the tilt is dropped and the shadow stays.
function setTiltedDragImage(e: DragEvent<HTMLElement>) {
  try {
    const source = e.currentTarget;
    const rect = source.getBoundingClientRect();
    const tilt = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : GHOST_TILT_DEG;

    const ghost = document.createElement('div');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.cssText = `position:fixed;top:-9999px;left:-9999px;padding:${GHOST_PAD_PX}px;pointer-events:none;`;

    const card = source.cloneNode(true) as HTMLElement;
    card.removeAttribute('draggable');
    card.style.cssText = `width:${rect.width}px;transform:rotate(${tilt}deg);box-shadow:0 14px 28px -8px hsl(var(--foreground) / 0.35);`;
    ghost.appendChild(card);
    document.body.appendChild(ghost);

    e.dataTransfer.setDragImage(
      ghost,
      e.clientX - rect.left + GHOST_PAD_PX,
      e.clientY - rect.top + GHOST_PAD_PX,
    );
    setTimeout(() => ghost.remove(), 0);
  } catch {
    // keep the default drag preview
  }
}

// Native HTML5 Drag and Drop API — no dnd library in this project (see
// TODO.md), zero-dependency, same convention as combobox/radar-chart.
// Native drag doesn't work on touch devices at all (a real spec
// limitation) — the "ย้ายเข้าแผน/เอาออกจากแผน" button below is an
// always-visible alternative (not touch-detected, since detection can be
// wrong) that calls the exact same move functions DragDropPlanner already
// uses for drop events, so there's only one state update path either way.
export function CourseDragCard({
  course,
  moveLabel,
  onMove,
}: Readonly<{
  course: AvailableCourse;
  moveLabel: string;
  onMove: () => void;
}>) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', course.courseId);
        e.dataTransfer.effectAllowed = 'move';
        setTiltedDragImage(e);
      }}
      className="flex cursor-grab flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-card p-3 active:cursor-grabbing"
    >
      {/* basis-48 + wrap: when the column is too narrow for name, badge and
          button on one line, the actions drop below instead of squeezing
          the course name to zero width. */}
      <div className="min-w-0 grow basis-48">
        <p className="text-sm font-medium text-primary">
          {course.code}: {course.name}
        </p>
        <p className="text-xs text-muted-foreground">{course.credits} หน่วยกิต</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            course.isRequired ? 'bg-brand-light text-brand' : 'bg-muted text-muted-foreground',
          )}
        >
          {course.isRequired ? 'วิชาบังคับ' : 'วิชาเลือก'}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-auto gap-1 whitespace-normal py-1.5 text-left"
          onClick={onMove}
        >
          <ArrowLeftRight size={14} aria-hidden="true" />
          {moveLabel}
        </Button>
      </div>
    </div>
  );
}
