'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Landmark } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createDepartment,
  createFaculty,
  createProgram,
  deleteDepartment,
  deleteFaculty,
  deleteProgram,
  fetchCurricula,
  fetchDepartments,
  fetchFaculties,
  fetchInactiveDepartments,
  fetchInactiveFaculties,
  fetchInactivePrograms,
  fetchPrograms,
  updateDepartment,
  updateFaculty,
  updateProgram,
} from '@/lib/api/organization';
import { Button } from '@/components/ui/button';
import { PageLoadError } from '@/components/layout/page-states';
import { Reveal } from '@/components/layout/reveal';
import { idsToExpandForLevel, type OrgLevel } from '@/lib/org-tree-view';
import { useToast } from '@/lib/toast-context';
import { OrgNodeRow } from './org-node-row';
import { InactiveOrgSection } from './inactive-org-section';
import { OrgEntityForm } from './org-entity-form';
import { buildOrgCounts, describeCounts } from '@/lib/org-tree-counts';
import { CurriculumPanel } from './curriculum-panel';
import { OrgStatRow } from './org-stat-row';
import { OrgToolbar } from './org-toolbar';
import { OrgTreeSkeleton } from './org-tree-skeleton';

const ORG_QUERY_KEYS = [['faculties'], ['departments'], ['programs'], ['curricula']];

function groupBy<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  }
  return map;
}

const byCode = <T extends { code: string }>(a: T, b: T) => a.code.localeCompare(b.code);

// Moves keyboard focus to a row's toggle once it is on screen (a row inside a node that has just
// opened mounts a frame or two later), then scrolls it into view.
function focusRow(id: string) {
  let tries = 0;
  const tick = () => {
    const el = document.getElementById(`org-toggle-${id}`);
    el?.focus({ preventScroll: true });
    if (el && document.activeElement === el) {
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' });
    } else if (tries++ < 30) {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
}

// The add-faculty form is opened from the page header, so its state lives with the page.
export function OrgTree({
  addingFaculty,
  onAddingFacultyChange,
}: Readonly<{ addingFaculty: boolean; onAddingFacultyChange: (adding: boolean) => void }>) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const toast = useToast();

  const facultiesQuery = useQuery({ queryKey: ['faculties'], queryFn: fetchFaculties });
  const departmentsQuery = useQuery({ queryKey: ['departments'], queryFn: fetchDepartments });
  const programsQuery = useQuery({ queryKey: ['programs'], queryFn: fetchPrograms });
  const curriculaQuery = useQuery({ queryKey: ['curricula'], queryFn: fetchCurricula });
  const queries = [facultiesQuery, departmentsQuery, programsQuery, curriculaQuery];
  // Read only what the inactive list has already loaded; it is fetched when the switch is on.
  const inactiveQueries = [
    useQuery({
      queryKey: ['inactive-org', 'faculties'],
      queryFn: fetchInactiveFaculties,
      enabled: false,
    }),
    useQuery({
      queryKey: ['inactive-org', 'departments'],
      queryFn: fetchInactiveDepartments,
      enabled: false,
    }),
    useQuery({
      queryKey: ['inactive-org', 'programs'],
      queryFn: fetchInactivePrograms,
      enabled: false,
    }),
  ];
  const inactiveCount = inactiveQueries.every((q) => q.data)
    ? inactiveQueries.reduce((sum, q) => sum + (q.data?.length ?? 0), 0)
    : null;

  // Await so callers only close their form once the tree shows the new data.
  async function refetchAll() {
    await Promise.all(
      ORG_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const faculties = useMemo(
    () => [...(facultiesQuery.data ?? [])].sort(byCode),
    [facultiesQuery.data],
  );
  const departmentsByFaculty = useMemo(
    () => groupBy(departmentsQuery.data ?? [], (d) => d.facultyId),
    [departmentsQuery.data],
  );
  const programsByDepartment = useMemo(
    () => groupBy(programsQuery.data ?? [], (p) => p.departmentId),
    [programsQuery.data],
  );
  const curriculaByProgram = useMemo(
    () => groupBy(curriculaQuery.data ?? [], (c) => c.programId),
    [curriculaQuery.data],
  );

  const counts = useMemo(
    () =>
      buildOrgCounts(
        facultiesQuery.data ?? [],
        departmentsQuery.data ?? [],
        programsQuery.data ?? [],
        curriculaQuery.data ?? [],
      ),
    [facultiesQuery.data, departmentsQuery.data, programsQuery.data, curriculaQuery.data],
  );

  const term = search.trim().toLowerCase();
  // `visible`: nodes to render while searching. `open`: ancestors of a node
  // that matches on its own text — merged into `expanded` (never removed)
  // so the match is on screen without discarding what the user opened.
  // Everything under a matching node stays visible (inherited match).
  const filter = useMemo(() => {
    if (term === '') return null;
    const hit = (item: { code: string; name: string }) =>
      item.code.toLowerCase().includes(term) || item.name.toLowerCase().includes(term);
    const visible = new Set<string>();
    const open = new Set<string>();
    const curriculumIds = new Set<string>();
    const fullPrograms = new Set<string>();

    for (const faculty of faculties) {
      const facultyOwn = hit(faculty);
      let facultyDesc = false;
      for (const department of departmentsByFaculty.get(faculty.id) ?? []) {
        const departmentOwn = hit(department);
        let departmentDesc = false;
        for (const program of programsByDepartment.get(department.id) ?? []) {
          const programOwn = hit(program);
          let programDesc = false;
          for (const curriculum of curriculaByProgram.get(program.id) ?? []) {
            if (curriculum.version.toLowerCase().includes(term)) {
              programDesc = true;
              curriculumIds.add(curriculum.id);
            }
          }
          const programSub = programOwn || programDesc;
          if (programOwn || departmentOwn || facultyOwn) fullPrograms.add(program.id);
          if (programSub || facultyOwn || departmentOwn) visible.add(program.id);
          if (programDesc) open.add(program.id);
          if (programSub) departmentDesc = true;
        }
        if (departmentDesc || departmentOwn || facultyOwn) visible.add(department.id);
        if (departmentDesc) open.add(department.id);
        if (departmentOwn || departmentDesc) facultyDesc = true;
      }
      if (facultyOwn || facultyDesc) visible.add(faculty.id);
      if (facultyDesc) open.add(faculty.id);
    }
    return { visible, open, curriculumIds, fullPrograms };
  }, [term, faculties, departmentsByFaculty, programsByDepartment, curriculaByProgram]);

  useEffect(() => {
    if (!filter || filter.open.size === 0) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      filter.open.forEach((id) => next.add(id));
      return next;
    });
  }, [filter]);

  // The first level opens once, so the tree shows at a glance that it has children.
  const openedFirstLevel = useRef(false);
  useEffect(() => {
    if (openedFirstLevel.current || faculties.length === 0) return;
    openedFirstLevel.current = true;
    setExpanded(new Set(faculties.map((f) => f.id)));
  }, [faculties]);

  function expandAll() {
    setExpanded(
      new Set([
        ...faculties.map((f) => f.id),
        ...(departmentsQuery.data ?? []).map((d) => d.id),
        ...(programsQuery.data ?? []).map((p) => p.id),
      ]),
    );
  }

  if (queries.some((q) => q.isLoading)) {
    return <OrgTreeSkeleton />;
  }
  if (queries.some((q) => q.isError)) {
    return <PageLoadError onRetry={() => queries.forEach((q) => void q.refetch())} />;
  }

  const shown = (id: string) => filter === null || filter.visible.has(id);
  const visibleFaculties = faculties.filter((f) => shown(f.id));
  const sortedDepartments = (facultyId: string) =>
    [...(departmentsByFaculty.get(facultyId) ?? [])].sort(byCode).filter((d) => shown(d.id));
  const sortedPrograms = (departmentId: string) =>
    [...(programsByDepartment.get(departmentId) ?? [])].sort(byCode).filter((p) => shown(p.id));

  // A stat card: open the tree down to that level and focus its first visible row.
  function revealLevel(level: OrgLevel) {
    setExpanded(
      idsToExpandForLevel(level, {
        faculties: faculties.map((f) => f.id),
        departments: (departmentsQuery.data ?? []).map((d) => d.id),
        programs: (programsQuery.data ?? []).map((p) => p.id),
      }),
    );
    const departments = visibleFaculties.flatMap((f) => sortedDepartments(f.id));
    const programs = departments.flatMap((d) => sortedPrograms(d.id));
    const target =
      level === 'faculty'
        ? visibleFaculties[0]
        : level === 'department'
          ? departments[0]
          : level === 'program'
            ? programs[0]
            : programs.find((p) => (curriculaByProgram.get(p.id) ?? []).length > 0);
    if (target) focusRow(target.id);
  }

  const resultCount = filter ? filter.visible.size + filter.curriculumIds.size : null;

  return (
    <div className="space-y-4">
      <OrgStatRow
        counts={{
          faculty: faculties.length,
          department: (departmentsQuery.data ?? []).length,
          program: (programsQuery.data ?? []).length,
          curriculum: (curriculaQuery.data ?? []).length,
        }}
        onPick={revealLevel}
      />

      <Reveal index={5}>
        <OrgToolbar
          search={search}
          onSearchChange={setSearch}
          resultCount={resultCount}
          onExpandAll={expandAll}
          onCollapseAll={() => setExpanded(new Set())}
          showInactive={showInactive}
          onShowInactiveChange={setShowInactive}
          inactiveCount={inactiveCount}
        />
      </Reveal>

      {addingFaculty && (
        <OrgEntityForm
          submitLabel="เพิ่มคณะ"
          onSubmit={async (values) => {
            await createFaculty(values);
            await refetchAll();
            toast.success('เพิ่มคณะแล้ว');
            onAddingFacultyChange(false);
          }}
          onCancel={() => onAddingFacultyChange(false)}
        />
      )}

      {faculties.length === 0 && !addingFaculty && (
        <EmptyState
          icon={Landmark}
          description="ยังไม่มีคณะในระบบ โครงสร้างองค์กรเริ่มจากคณะ แล้วจึงเพิ่มภาควิชา สาขา และหลักสูตรต่อ"
          action={
            <Button type="button" onClick={() => onAddingFacultyChange(true)}>
              เพิ่มคณะใหม่
            </Button>
          }
        />
      )}
      {faculties.length > 0 && visibleFaculties.length === 0 && (
        <EmptyState
          illustration="no-results"
          size="sm"
          description="ไม่พบรายการที่ตรงกับคำค้นหา ลองใช้ชื่อหรือรหัสอื่น"
          action={
            <Button type="button" variant="outline" onClick={() => setSearch('')}>
              ล้างการค้นหา
            </Button>
          }
        />
      )}

      <div className="space-y-3">
        {visibleFaculties.map((faculty) => {
          const allDepartments = [...(departmentsByFaculty.get(faculty.id) ?? [])].sort(byCode);
          const departments = sortedDepartments(faculty.id);
          const facultyCounts = counts.faculty.get(faculty.id)!;
          return (
            <OrgNodeRow
              key={faculty.id}
              item={faculty}
              level="faculty"
              term={term}
              summary={describeCounts(facultyCounts, ['departments', 'programs', 'curricula'])}
              childCount={allDepartments.length}
              childLabel="ภาควิชา"
              expanded={expanded.has(faculty.id)}
              onToggle={() => toggle(faculty.id)}
              onUpdate={async (values) => {
                await updateFaculty(faculty.id, values);
                await refetchAll();
                toast.success('บันทึกคณะแล้ว');
              }}
              onDeactivate={async () => {
                await deleteFaculty(faculty.id);
                await refetchAll();
                toast.success('ปิดใช้งานคณะแล้ว');
              }}
              addChild={{
                childLabel: 'ภาควิชา',
                onCreate: async (values) => {
                  await createDepartment({ ...values, facultyId: faculty.id });
                  await refetchAll();
                  toast.success('เพิ่มภาควิชาแล้ว');
                },
              }}
            >
              {departments.map((department) => {
                const allPrograms = [...(programsByDepartment.get(department.id) ?? [])].sort(
                  byCode,
                );
                const programs = sortedPrograms(department.id);
                return (
                  <OrgNodeRow
                    key={department.id}
                    item={department}
                    level="department"
                    term={term}
                    summary={describeCounts(counts.department.get(department.id)!, [
                      'programs',
                      'curricula',
                    ])}
                    childCount={allPrograms.length}
                    childLabel="สาขา"
                    expanded={expanded.has(department.id)}
                    onToggle={() => toggle(department.id)}
                    onUpdate={async (values) => {
                      await updateDepartment(department.id, values);
                      await refetchAll();
                      toast.success('บันทึกภาควิชาแล้ว');
                    }}
                    onDeactivate={async () => {
                      await deleteDepartment(department.id);
                      await refetchAll();
                      toast.success('ปิดใช้งานภาควิชาแล้ว');
                    }}
                    addChild={{
                      childLabel: 'สาขา',
                      onCreate: async (values) => {
                        await createProgram({ ...values, departmentId: department.id });
                        await refetchAll();
                        toast.success('เพิ่มสาขาแล้ว');
                      },
                    }}
                  >
                    {programs.map((program) => {
                      const allCurricula = curriculaByProgram.get(program.id) ?? [];
                      // Curricula narrow only when the program itself matched
                      // through one of them; a matching program/department/
                      // faculty keeps its whole subtree.
                      const curricula =
                        filter !== null && !filter.fullPrograms.has(program.id)
                          ? allCurricula.filter((c) => filter.curriculumIds.has(c.id))
                          : allCurricula;
                      return (
                        <OrgNodeRow
                          key={program.id}
                          item={program}
                          level="program"
                          term={term}
                          summary={describeCounts(counts.program.get(program.id)!, ['curricula'])}
                          childCount={allCurricula.length}
                          childLabel="หลักสูตร"
                          expanded={expanded.has(program.id)}
                          onToggle={() => toggle(program.id)}
                          onUpdate={async (values) => {
                            await updateProgram(program.id, values);
                            await refetchAll();
                            toast.success('บันทึกสาขาแล้ว');
                          }}
                          onDeactivate={async () => {
                            await deleteProgram(program.id);
                            await refetchAll();
                            toast.success('ปิดใช้งานสาขาแล้ว');
                          }}
                        >
                          <CurriculumPanel
                            programId={program.id}
                            curricula={curricula}
                            onChanged={refetchAll}
                            readOnly
                          />
                        </OrgNodeRow>
                      );
                    })}
                  </OrgNodeRow>
                );
              })}
            </OrgNodeRow>
          );
        })}
      </div>

      {showInactive && (
        <section aria-labelledby="inactive-org-heading" className="space-y-3 pt-2">
          <div>
            <h2 id="inactive-org-heading" className="text-lg font-semibold text-primary">
              ที่ปิดใช้งาน
            </h2>
            <p className="text-sm text-muted-foreground">
              หน่วยงานและหลักสูตรที่ปิดใช้งานไปแล้ว เปิดกลับมาใช้งานได้ที่นี่
            </p>
          </div>
          <InactiveOrgSection />
        </section>
      )}
    </div>
  );
}
