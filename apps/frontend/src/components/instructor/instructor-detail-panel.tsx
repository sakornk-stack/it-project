'use client';

import { useId, type KeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { InstructorCourseSummary } from '@eduanalyze-ai/shared-types';
import {
  invalidateAfterGradeChange,
  useCourseCloAchievement,
  useCourseRoster,
} from '@/lib/instructor-queries';
import { nextTabIndex } from '@/lib/tab-keys';
import { cn } from '@/lib/utils';
import { buildCourseOverviews } from '@/lib/instructor-overview';
import { Reveal } from '@/components/layout/reveal';
import { CloAchievementSection } from './clo-achievement-section';
import { StudentRosterTable } from './student-roster-table';
import { CourseInfoSection } from './course-info-section';
import { CourseFollowUpList } from './course-follow-up-list';
import { CourseHero } from './course-hero';
import { CourseOverview } from './course-overview';

export type InstructorTab = 'overview' | 'students' | 'clo';

// Three tabs, in the order of the work done most often. The old Gradebook tab
// was the same table as Students with grade editing switched on; that is now a
// mode inside Students ("แก้ไขเกรด"), off until the instructor asks for it.
// Overview absorbed the old standalone 'grades' (distribution/trend charts)
// and 'course' (metadata/prerequisites) tabs.
const TABS: { key: InstructorTab; label: string }[] = [
  { key: 'overview', label: 'ภาพรวม' },
  { key: 'students', label: 'นิสิต' },
  { key: 'clo', label: 'CLO และ PLO' },
];

// Backward-compat for bookmarked/shared links from before the restructure:
// ?tab=grades / trend / course fall back onto Overview, and so does any value
// that is not a tab; ?tab=gradebook and
// ?tab=roster (the editable table) land on Students in view mode, with the
// ?student= deep link kept so the same person is opened.
const LEGACY_TAB_ALIASES: Record<string, InstructorTab> = {
  grades: 'overview',
  trend: 'overview',
  course: 'overview',
  gradebook: 'students',
  roster: 'students',
};

export function parseInstructorTab(value: string | null): InstructorTab {
  if (value && TABS.some((tab) => tab.key === value)) return value as InstructorTab;
  if (value && Object.prototype.hasOwnProperty.call(LEGACY_TAB_ALIASES, value)) {
    return LEGACY_TAB_ALIASES[value];
  }
  return 'overview';
}

// Both queries here are lazy — enabled only once their tab is actually
// opened — so switching between courses without ever visiting the CLO or
// Roster tab never fires more than the one dashboard-level request.
export function InstructorDetailPanel({
  course,
  activeTab,
  onTabChange,
  isInstructor,
  initialSelectedStudentId,
}: {
  course: InstructorCourseSummary;
  activeTab: InstructorTab;
  onTabChange: (tab: InstructorTab) => void;
  isInstructor: boolean;
  initialSelectedStudentId?: string;
}) {
  const queryClient = useQueryClient();
  const tabsId = useId();
  const tabId = (key: InstructorTab) => `${tabsId}-tab-${key}`;
  const panelId = (key: InstructorTab) => `${tabsId}-panel-${key}`;

  // Arrow keys move focus along the tabs; Enter or Space (the button's own click)
  // opens the focused one, so moving along does not add a history entry per key.
  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = nextTabIndex(index, event.key, TABS.length);
    if (next === null) return;
    event.preventDefault();
    document.getElementById(tabId(TABS[next].key))?.focus();
  }

  function handleTabChange(tab: InstructorTab) {
    if (tab !== activeTab) onTabChange(tab);
  }

  const cloQuery = useCourseCloAchievement(course.courseId, {
    enabled: isInstructor && activeTab === 'clo',
  });

  const rosterQuery = useCourseRoster(course.courseId, {
    enabled: isInstructor && (activeTab === 'students' || activeTab === 'clo'),
  });

  function handleGradebookChanged() {
    invalidateAfterGradeChange(queryClient, course.courseId);
  }

  return (
    <>
      <Reveal index={0}>
        <CourseHero course={course} heading="h1" />
      </Reveal>

      {/* Tabs sit on the page itself; every section below is a card of its own. */}
      <Reveal index={1}>
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <div
            role="tablist"
            aria-label="หัวข้อของรายวิชา"
            className="flex min-w-max gap-x-2 border-b border-slate-200"
          >
            {TABS.map(({ key, label }, index) => (
              <button
                key={key}
                id={tabId(key)}
                type="button"
                role="tab"
                aria-selected={activeTab === key}
                aria-controls={panelId(key)}
                tabIndex={activeTab === key ? 0 : -1}
                onClick={() => handleTabChange(key)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={cn(
                  '-mb-px min-h-11 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                  activeTab === key
                    ? 'border-brand text-brand'
                    : 'border-transparent text-muted-foreground hover:text-primary',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      {activeTab === 'overview' && (
        <div role="tabpanel" id={panelId('overview')} aria-labelledby={tabId('overview')}>
          <Reveal index={2}>
            <CourseOverview
              course={course}
              aside={
                <>
                  <CourseFollowUpList courseId={course.courseId} students={course.atRiskStudents} />
                  <CourseInfoSection course={course} />
                </>
              }
            />
          </Reveal>
        </div>
      )}

      {activeTab === 'clo' && (
        <div role="tabpanel" id={panelId('clo')} aria-labelledby={tabId('clo')}>
          <Reveal index={2}>
            <CloAchievementSection
              gradedPeople={buildCourseOverviews([course])[0].stats.graded}
              achievementPercent={course.achievementPercent}
              clos={course.clos}
              plos={course.plos}
              courseAssessment={course.courseAssessment}
              detail={cloQuery.data}
              isLoading={cloQuery.isLoading}
              isError={cloQuery.isError}
              onRetry={() => void cloQuery.refetch()}
            />
          </Reveal>
        </div>
      )}

      {activeTab === 'students' && (
        <div role="tabpanel" id={panelId('students')} aria-labelledby={tabId('students')}>
          <Reveal index={2}>
            <StudentRosterTable
              courseId={course.courseId}
              courseCode={course.code}
              roster={rosterQuery.data}
              isLoading={rosterQuery.isLoading}
              isError={rosterQuery.isError}
              onRetry={() => void rosterQuery.refetch()}
              onChanged={isInstructor ? handleGradebookChanged : undefined}
              initialSelectedStudentId={initialSelectedStudentId}
            />
          </Reveal>
        </div>
      )}
    </>
  );
}
