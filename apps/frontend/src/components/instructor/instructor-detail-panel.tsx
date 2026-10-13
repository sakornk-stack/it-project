'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { InstructorCourseSummary } from '@eduanalyze-ai/shared-types';
import { fetchCourseCloAchievement, fetchCourseRoster } from '@/lib/api/instructor';
import { fetchCourseEvidenceCoverage } from '@/lib/evidence-coverage';
import { cn } from '@/lib/utils';
import { buildCourseOverviews } from '@/lib/instructor-overview';
import { UNSAVED_SCORES_CONFIRM } from '@/lib/score-form-guard';
import { useConfirm } from '@/lib/use-confirm';
import { useUnsavedNavigationGuard } from '@/lib/use-unsaved-navigation-guard';
import { Reveal } from '@/components/layout/reveal';
import { Card, CardContent } from '@/components/ui/card';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { CloAchievementSection } from './clo-achievement-section';
import { StudentRosterTable } from './student-roster-table';
import { AssessmentEvidenceSection } from './assessment-evidence-section';
import { CourseInfoSection } from './course-info-section';
import { CourseFollowUpList } from './course-follow-up-list';
import { CourseHero } from './course-hero';
import { CourseOverview } from './course-overview';

export type InstructorTab = 'overview' | 'students' | 'evidence' | 'clo';

// Four tabs, in the order of the work done most often. The old Gradebook tab
// was the same table as Students with grade editing switched on; that is now a
// mode inside Students ("แก้ไขเกรด"), off until the instructor asks for it.
// Overview absorbed the old standalone 'grades' (distribution/trend charts)
// and 'course' (metadata/prerequisites) tabs.
const TABS: { key: InstructorTab; label: string }[] = [
  { key: 'overview', label: 'ภาพรวม' },
  { key: 'students', label: 'นิสิต' },
  { key: 'evidence', label: 'กรอกคะแนน' },
  { key: 'clo', label: 'เป้าการเรียนรู้' },
];

// Backward-compat for bookmarked/shared links from before the restructure:
// ?tab=grades / trend / course fall back onto Overview; ?tab=gradebook and
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
  if (value && value in LEGACY_TAB_ALIASES) return LEGACY_TAB_ALIASES[value];
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

  // Set by the score form while it holds edits that are not saved yet.
  const [hasUnsavedScores, setHasUnsavedScores] = useState(false);
  const { confirm, dialog } = useConfirm();
  useUnsavedNavigationGuard(hasUnsavedScores, () => confirm(UNSAVED_SCORES_CONFIRM));
  async function handleTabChange(tab: InstructorTab) {
    if (tab === activeTab) return;
    if (hasUnsavedScores && !(await confirm(UNSAVED_SCORES_CONFIRM))) return;
    onTabChange(tab);
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

      <Reveal index={1}>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap gap-x-2 border-b border-slate-100">
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  aria-current={activeTab === key ? 'true' : undefined}
                  onClick={() => handleTabChange(key)}
                  className={cn(
                    'min-h-11 border-b-2 px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    activeTab === key
                      ? 'border-brand text-brand'
                      : 'border-transparent text-slate-500 hover:text-primary',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <Reveal index={0}>
                <div className="space-y-6">
                  <CourseOverview course={course} />
                  <CourseFollowUpList courseId={course.courseId} students={course.atRiskStudents} />
                  <CollapsibleSection
                    framed={false}
                    title="ข้อมูลรายวิชา"
                    meta={
                      <span className="text-sm font-normal text-muted-foreground">
                        หน่วยกิต และวิชาที่ต้องผ่านก่อน
                      </span>
                    }
                  >
                    <CourseInfoSection course={course} />
                  </CollapsibleSection>
                </div>
              </Reveal>
            )}

            {activeTab === 'clo' && (
              <Reveal index={0}>
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
              <Reveal index={0}>
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
              </Reveal>
            )}

            {/* Own internal queries (not the enabled-per-tab pattern above) —
                mounting only while this tab is active already keeps it from
                firing requests when unused, same net effect. */}
            {activeTab === 'evidence' && isInstructor && (
              <Reveal index={0}>
                <AssessmentEvidenceSection
                  courseId={course.courseId}
                  clos={course.clos}
                  onUnsavedChange={setHasUnsavedScores}
                />
              </Reveal>
            )}
          </CardContent>
        </Card>
      </Reveal>
      {dialog}
    </>
  );
}
