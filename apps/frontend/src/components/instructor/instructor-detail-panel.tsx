'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import type { InstructorCourseSummary } from '@eduanalyze-ai/shared-types';
import { fetchCourseCloAchievement, fetchCourseRoster } from '@/lib/api/instructor';
import { fetchCourseEvidenceCoverage } from '@/lib/evidence-coverage';
import { cn } from '@/lib/utils';
import { buildCourseOverviews } from '@/lib/instructor-overview';
import { Reveal } from '@/components/layout/reveal';
import { CloAchievementSection } from './clo-achievement-section';
import { StudentRosterTable } from './student-roster-table';
import { CourseInfoSection } from './course-info-section';
import { CourseFollowUpList } from './course-follow-up-list';
import { CourseHero } from './course-hero';
import { CourseOverview } from './course-overview';
import { SectionCard } from './section-card';

export type InstructorTab = 'overview' | 'students' | 'clo';

// Three tabs, in the order of the work done most often. The old Gradebook tab
// was the same table as Students with grade editing switched on; that is now a
// mode inside Students ("แก้ไขเกรด"), off until the instructor asks for it.
// Overview absorbed the old standalone 'grades' (distribution/trend charts)
// and 'course' (metadata/prerequisites) tabs.
const TABS: { key: InstructorTab; label: string }[] = [
  { key: 'overview', label: 'ภาพรวม' },
  { key: 'students', label: 'นิสิต' },
  { key: 'clo', label: 'เป้าการเรียนรู้' },
];

// Backward-compat for bookmarked/shared links from before the restructure:
// ?tab=grades / trend / course fall back onto Overview, and so does any value
// that is not a tab (the retired score-entry tab, ?tab=evidence, included); ?tab=gradebook and
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

  function handleTabChange(tab: InstructorTab) {
    if (tab !== activeTab) onTabChange(tab);
  }

  const cloQuery = useQuery({
    queryKey: ['course-clo-achievement', course.courseId],
    queryFn: () => fetchCourseCloAchievement(course.courseId),
    enabled: isInstructor && activeTab === 'clo',
  });

  const rosterQuery = useQuery({
    queryKey: ['course-roster', course.courseId],
    queryFn: () => fetchCourseRoster(course.courseId),
    enabled: isInstructor && (activeTab === 'students' || activeTab === 'clo'),
  });

  // Evidence coverage sits beside the grade-based numbers on the CLO tab so
  // the two are never confused for one another.
  const evidenceCoverageQuery = useQuery({
    queryKey: ['course-evidence-coverage', course.courseId],
    queryFn: () => fetchCourseEvidenceCoverage(course.courseId),
    enabled: isInstructor && activeTab === 'clo',
  });

  function handleGradebookChanged() {
    void queryClient.invalidateQueries({
      queryKey: ['course-roster', course.courseId],
    });
    void queryClient.invalidateQueries({ queryKey: ['instructor-dashboard'] });
  }

  return (
    <>
      <Reveal index={0}>
        <CourseHero course={course} heading="h1" />
      </Reveal>

      {/* Tabs sit on the page itself; every section below is a card of its own. */}
      <Reveal index={1}>
        <nav aria-label="หัวข้อของรายวิชา" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <div className="flex min-w-max gap-x-2 border-b border-slate-200">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                aria-current={activeTab === key ? 'true' : undefined}
                onClick={() => handleTabChange(key)}
                className={cn(
                  '-mb-px min-h-11 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                  activeTab === key
                    ? 'border-brand text-brand'
                    : 'border-transparent text-slate-500 hover:text-primary',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>
      </Reveal>

      {activeTab === 'overview' && (
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
      )}

      {activeTab === 'clo' && (
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
            evidenceCoverage={evidenceCoverageQuery.data}
            evidenceTotal={rosterQuery.data?.length}
            evidenceError={evidenceCoverageQuery.isError}
          />
        </Reveal>
      )}

      {activeTab === 'students' && (
        <Reveal index={2}>
          <SectionCard
            icon={Users}
            title="รายชื่อนิสิต"
            description="ค้นหา เรียงลำดับ และเปิดดูผลการเรียนของนิสิตแต่ละคนในวิชานี้"
          >
            <StudentRosterTable
              courseId={course.courseId}
              courseCode={course.code}
              clos={course.clos}
              roster={rosterQuery.data}
              isLoading={rosterQuery.isLoading}
              isError={rosterQuery.isError}
              onChanged={isInstructor ? handleGradebookChanged : undefined}
              initialSelectedStudentId={initialSelectedStudentId}
            />
          </SectionCard>
        </Reveal>
      )}
    </>
  );
}
