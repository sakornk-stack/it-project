'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { CloAchievementEntry } from '@eduanalyze-ai/shared-types';
import {
  fetchAssessmentCloMappings,
  fetchAssessmentDefinitions,
} from '@/lib/api/assessment-evidence';
import { UNSAVED_SCORES_CONFIRM } from '@/lib/score-form-guard';
import { useConfirm } from '@/lib/use-confirm';
import { AssessmentDefinitionPanel } from './assessment-definition-panel';
import { AssessmentCloMappingPanel } from './assessment-clo-mapping-panel';
import { StudentScoreEntryPanel } from './student-score-entry-panel';
import { EvidenceStep } from './evidence-step';

// Orchestrates the 3-level drill-down (Assessment -> CLO mapping -> Score
// entry) behind the instructor dashboard's "evidence" tab. The selection
// lives in ?def= / ?clo= so a reload lands on the same score table. It is
// written with router.replace (never push): Back/Forward must not be able to
// change the mapping without passing confirmDiscardUnsaved, which
// beforeunload cannot cover for client-side navigation.
//
// Feeds the new assessment-evidence infrastructure only — never reads or
// writes CourseAssessmentCloScore (the 1-5 self-assessment) or the
// grade-based CloAchievementService/PloAchievementService.
export function AssessmentEvidenceSection({
  courseId,
  clos,
  onUnsavedChange,
}: {
  courseId: string;
  clos: CloAchievementEntry[];
  // Lets the page guard tab/course switches while scores are unsaved.
  onUnsavedChange?: (hasUnsaved: boolean) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const defParam = searchParams.get('def');
  const cloParam = searchParams.get('clo');

  const [hasUnsavedScores, setHasUnsavedScores] = useState(false);

  // Same query keys the panels below use, so these resolve from cache. They
  // validate the URL ids: a stale, foreign or hand-edited id is dropped.
  const definitionsQuery = useQuery({
    queryKey: ['assessment-definitions', courseId],
    queryFn: () => fetchAssessmentDefinitions(courseId),
  });
  const selectedDefinitionId =
    defParam && definitionsQuery.data?.some((d) => d.id === defParam) ? defParam : null;

  const mappingsQuery = useQuery({
    queryKey: ['assessment-clo-mappings', selectedDefinitionId],
    queryFn: () => fetchAssessmentCloMappings(selectedDefinitionId!, courseId),
    enabled: !!selectedDefinitionId,
  });
  const selectedMappingId =
    cloParam && mappingsQuery.data?.some((m) => m.id === cloParam) ? cloParam : null;

  const updateParams = useCallback(
    (changes: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) params.delete(key);
        else params.set(key, value);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  // Drop ids that did not validate, but only once the data that could
  // validate them has actually loaded.
  useEffect(() => {
    if (!defParam) {
      if (cloParam) updateParams({ clo: null });
      return;
    }
    if (!definitionsQuery.isSuccess) return;
    if (!selectedDefinitionId) {
      updateParams({ def: null, clo: null });
      return;
    }
    if (cloParam && mappingsQuery.isSuccess && !selectedMappingId) {
      updateParams({ clo: null });
    }
  }, [
    defParam,
    cloParam,
    definitionsQuery.isSuccess,
    mappingsQuery.isSuccess,
    selectedDefinitionId,
    selectedMappingId,
    updateParams,
  ]);

  useEffect(() => {
    if (!selectedMappingId) setHasUnsavedScores(false);
  }, [selectedMappingId]);

  // An assessment linked to exactly one goal has nothing to choose in step 2, so
  // that goal is picked for the instructor and the score table opens at once. Only
  // the ?clo= selection changes (replace, no history entry); nothing is written.
  // Nothing is typed yet when no goal is selected, so there is nothing to lose.
  const onlyMappingId =
    mappingsQuery.data && mappingsQuery.data.length === 1 ? mappingsQuery.data[0].id : null;
  useEffect(() => {
    if (selectedDefinitionId && !cloParam && onlyMappingId) updateParams({ clo: onlyMappingId });
  }, [selectedDefinitionId, cloParam, onlyMappingId, updateParams]);

  useEffect(() => {
    onUnsavedChange?.(hasUnsavedScores);
  }, [hasUnsavedScores, onUnsavedChange]);

  // Leaving this tab unmounts the form, so nothing is unsaved any more.
  useEffect(() => () => onUnsavedChange?.(false), [onUnsavedChange]);

  // Unsaved score edits live only in the score panel's form; leaving it for
  // another assessment/CLO discards them, so ask first.
  const { confirm, dialog } = useConfirm();
  async function confirmDiscardUnsaved(): Promise<boolean> {
    return !hasUnsavedScores || (await confirm(UNSAVED_SCORES_CONFIRM));
  }

  async function selectDefinition(definitionId: string) {
    if (definitionId === selectedDefinitionId) return;
    if (!(await confirmDiscardUnsaved())) return;
    setHasUnsavedScores(false);
    updateParams({ def: definitionId, clo: null });
  }

  async function selectMapping(mappingId: string) {
    if (mappingId === selectedMappingId) return;
    if (!(await confirmDiscardUnsaved())) return;
    updateParams({ clo: mappingId });
  }

  return (
    <div className="space-y-8">
      <EvidenceStep
        number={1}
        title="เลือกการประเมิน"
        hint="การประเมิน คือข้อสอบ ควิซ หรืองานที่ให้คะแนน"
        done={!!selectedDefinitionId}
      >
        <AssessmentDefinitionPanel
          courseId={courseId}
          selectedDefinitionId={selectedDefinitionId}
          onSelect={selectDefinition}
        />
      </EvidenceStep>

      <EvidenceStep
        number={2}
        title="เลือกเป้าการเรียนรู้ที่จะกรอกคะแนน"
        hint="เป้าการเรียนรู้ (CLO) คือสิ่งที่นิสิตควรทำได้เมื่อเรียนจบวิชา ถ้ามีข้อเดียวระบบเลือกให้เอง"
        done={!!selectedMappingId}
        waiting={!selectedDefinitionId}
        waitingText="เลือกการประเมินในขั้นที่ 1 ก่อน"
      >
        {selectedDefinitionId && (
          <AssessmentCloMappingPanel
            key={selectedDefinitionId}
            courseId={courseId}
            clos={clos}
            assessmentDefinitionId={selectedDefinitionId}
            selectedMappingId={selectedMappingId}
            onSelect={(mappingId) => selectMapping(mappingId)}
          />
        )}
      </EvidenceStep>

      <EvidenceStep
        number={3}
        title="กรอกคะแนน"
        waiting={!(selectedDefinitionId && selectedMappingId)}
        waitingText="เลือกเป้าการเรียนรู้ในขั้นที่ 2 ก่อน แล้วจะกรอกคะแนนได้ที่นี่"
      >
        {selectedDefinitionId && selectedMappingId && (
          <StudentScoreEntryPanel
            courseId={courseId}
            assessmentDefinitionId={selectedDefinitionId}
            assessmentCloMappingId={selectedMappingId}
            clos={clos}
            onDirtyChange={setHasUnsavedScores}
          />
        )}
      </EvidenceStep>
      {dialog}
    </div>
  );
}
