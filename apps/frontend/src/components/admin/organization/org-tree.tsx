'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, GraduationCap, Landmark } from 'lucide-react';
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
  fetchPrograms,
  updateDepartment,
  updateFaculty,
  updateProgram,
} from '@/lib/api/organization';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/lib/toast-context';
import { OrgNodeRow } from './org-node-row';
import { InactiveOrgSection } from './inactive-org-section';
import { OrgEntityForm } from './org-entity-form';
import { buildOrgCounts, describeCounts } from '@/lib/org-tree-counts';
import { StatCard } from '@/components/dashboard/stat-card';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { CurriculumPanel } from './curriculum-panel';

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

export function OrgTree() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [addingFaculty, setAddingFaculty] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const toast = useToast();

  const facultiesQuery = useQuery({ queryKey: ['faculties'], queryFn: fetchFaculties });
  const departmentsQuery = useQuery({ queryKey: ['departments'], queryFn: fetchDepartments });
  const programsQuery = useQuery({ queryKey: ['programs'], queryFn: fetchPrograms });
  const curriculaQuery = useQuery({ queryKey: ['curricula'], queryFn: fetchCurricula });
  const queries = [facultiesQuery, departmentsQuery, programsQuery, curriculaQuery];

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
    return <ListSkeleton items={5} />;
  }
  if (queries.some((q) => q.isError)) {
    return <p className="text-sm text-destructive">ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง</p>;
  }

  const shown = (id: string) => filter === null || filter.visible.has(id);
  const visibleFaculties = faculties.filter((f) => shown(f.id));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Landmark}
          label="คณะ"
          value={<AnimatedNumber value={faculties.length} />}
          suffix="คณะ"
        />
        <StatCard
          icon={Building2}
          label="ภาควิชา"
          value={<AnimatedNumber value={(departmentsQuery.data ?? []).length} />}
          suffix="ภาควิชา"
        />
        <StatCard
          icon={GraduationCap}
          label="สาขา"
          value={<AnimatedNumber value={(programsQuery.data ?? []).length} />}
          suffix="สาขา"
        />
        <StatCard
          icon={GraduationCap}
          label="หลักสูตร"
          value={<AnimatedNumber value={(curriculaQuery.data ?? []).length} />}
          suffix="หลักสูตร"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="ค้นหาชื่อ/รหัส คณะ ภาควิชา สาขา หรือฉบับหลักสูตร..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={expandAll}>
          ขยายทั้งหมด
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(new Set())}>
          ยุบทั้งหมด
        </Button>
        <Button
          type="button"
          variant={showInactive ? 'default' : 'outline'}
          size="sm"
          aria-pressed={showInactive}
          onClick={() => setShowInactive((open) => !open)}
        >
          {showInactive ? 'ซ่อนที่ปิดใช้งาน' : 'แสดงที่ปิดใช้งาน'}
        </Button>
        {!addingFaculty && (
          <Button type="button" onClick={() => setAddingFaculty(true)}>
            + เพิ่มคณะใหม่
          </Button>
        )}
      </div>

      {addingFaculty && (
        <OrgEntityForm
          submitLabel="เพิ่มคณะ"
          onSubmit={async (values) => {
            await createFaculty(values);
            await refetchAll();
            toast.success('เพิ่มคณะแล้ว');
            setAddingFaculty(false);
          }}
          onCancel={() => setAddingFaculty(false)}
        />
      )}

      {faculties.length === 0 && !addingFaculty && (
        <EmptyState
          icon={Landmark}
          description="ยังไม่มีคณะในระบบ โครงสร้างองค์กรเริ่มจากคณะ แล้วจึงเพิ่มภาควิชา สาขา และหลักสูตรต่อ"
          action={
            <Button type="button" onClick={() => setAddingFaculty(true)}>
              เพิ่มคณะแรก
            </Button>
          }
        />
      )}
      {faculties.length > 0 && visibleFaculties.length === 0 && (
        <EmptyState illustration="no-results" size="sm" description="ไม่พบรายการที่ตรงกับคำค้นหา" />
      )}

      <div className="space-y-3">
        {visibleFaculties.map((faculty) => {
          const allDepartments = [...(departmentsByFaculty.get(faculty.id) ?? [])].sort(byCode);
          const departments = allDepartments.filter((d) => shown(d.id));
          const facultyCounts = counts.faculty.get(faculty.id)!;
          return (
            <OrgNodeRow
              key={faculty.id}
              item={faculty}
              icon={Landmark}
              levelLabel="คณะ"
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
                const programs = allPrograms.filter((p) => shown(p.id));
                return (
                  <OrgNodeRow
                    key={department.id}
                    item={department}
                    icon={Building2}
                    levelLabel="ภาควิชา"
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
                          icon={GraduationCap}
                          levelLabel="สาขา"
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
