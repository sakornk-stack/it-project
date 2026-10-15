'use client';

import { useEffect, useMemo } from 'react';
import { Info } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useFormContext } from 'react-hook-form';
import { fetchDepartments, fetchFaculties, fetchPrograms } from '@/lib/api/organization';
import { allowedLevels, type AllowedScopeTargets } from '@/lib/admin-scope-options';
import { SCOPE_LEVEL_LABELS } from '@/lib/scope-labels';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Picks exactly one of Faculty/Department/Program (not always drilling
// down to Curriculum like DependentOrgSelect does for student
// registration) — a UserScope covers everything below the chosen level,
// so the admin only ever needs to land on one node in the hierarchy.
// Field names are parameterized so this same component works both inside
// CreateUserForm (scopeLevel/scopeTargetId, since those fields are
// optional there) and inside a standalone grant-scope form (level/
// targetId, matching scope.schema.ts).
//
// `allowed` narrows both lists to the units inside the requester's own scope
// (Admin creating an account). A list with one entry is chosen for them and
// shown as text; omitted, nothing is filtered.
const TRIGGER_CLASS =
  'flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export function ScopeSelector({
  levelFieldName = 'level',
  targetFieldName = 'targetId',
  allowed,
  limitedToOwnScope = false,
}: {
  levelFieldName?: string;
  targetFieldName?: string;
  allowed?: AllowedScopeTargets;
  // True when `allowed` was narrowed by the requester's own scope: with one unit
  // left, a note says why there is no choice.
  limitedToOwnScope?: boolean;
}) {
  const { control, watch, resetField, setValue } = useFormContext();
  const level = watch(levelFieldName);

  const facultiesQuery = useQuery({ queryKey: ['faculties'], queryFn: fetchFaculties });
  const departmentsQuery = useQuery({ queryKey: ['departments'], queryFn: fetchDepartments });
  const programsQuery = useQuery({ queryKey: ['programs'], queryFn: fetchPrograms });

  // Names alone are ambiguous (two faculties can each have a "วิศวกรรมคอมพิวเตอร์"
  // program), so each option carries its parent chain and code, and all of it
  // is searchable. Inactive nodes are left out: the backend rejects them.
  const levels = useMemo(
    () =>
      allowed
        ? allowedLevels(allowed)
        : (Object.keys(SCOPE_LEVEL_LABELS) as (keyof typeof SCOPE_LEVEL_LABELS)[]),
    [allowed],
  );
  const onlyLevel = allowed && levels.length === 1 ? levels[0] : null;

  const targetOptions = useMemo<ComboboxOption[]>(() => {
    const faculties = facultiesQuery.data ?? [];
    const departments = departmentsQuery.data ?? [];
    const programs = programsQuery.data ?? [];
    const facultyName = new Map(faculties.map((f) => [f.id, f.name]));
    const departmentById = new Map(departments.map((d) => [d.id, d]));

    function option(id: string, name: string, code: string, context: string[]): ComboboxOption {
      const contextText = context.filter(Boolean).join(' › ');
      return {
        value: id,
        label: contextText ? `${name} (${code}) · ${contextText}` : `${name} (${code})`,
        searchText: `${name} ${code} ${contextText}`,
      };
    }

    const permitted = (kind: keyof typeof SCOPE_LEVEL_LABELS, id: string) =>
      !allowed || allowed[kind].has(id);

    if (level === 'FACULTY') {
      return faculties
        .filter((f) => f.isActive && permitted('FACULTY', f.id))
        .map((f) => option(f.id, f.name, f.code, []));
    }
    if (level === 'DEPARTMENT') {
      return departments
        .filter((d) => d.isActive && permitted('DEPARTMENT', d.id))
        .map((d) => option(d.id, d.name, d.code, [facultyName.get(d.facultyId) ?? '']));
    }
    if (level === 'PROGRAM') {
      return programs
        .filter((p) => p.isActive && permitted('PROGRAM', p.id))
        .map((p) => {
          const department = departmentById.get(p.departmentId);
          return option(p.id, p.name, p.code, [
            department ? (facultyName.get(department.facultyId) ?? '') : '',
            department?.name ?? '',
          ]);
        });
    }
    return [];
  }, [level, allowed, facultiesQuery.data, departmentsQuery.data, programsQuery.data]);

  const onlyTarget = allowed && targetOptions.length === 1 ? targetOptions[0] : null;

  // One choice left: make it, so the form never asks a question with one answer.
  useEffect(() => {
    if (onlyLevel && level !== onlyLevel) setValue(levelFieldName, onlyLevel);
  }, [onlyLevel, level, levelFieldName, setValue]);
  const onlyTargetId = onlyTarget?.value;
  const currentTarget = watch(targetFieldName);
  useEffect(() => {
    if (onlyTargetId && currentTarget !== onlyTargetId) setValue(targetFieldName, onlyTargetId);
  }, [onlyTargetId, currentTarget, targetFieldName, setValue]);

  const orgQueries = [facultiesQuery, departmentsQuery, programsQuery];
  if (orgQueries.some((q) => q.isError)) {
    return (
      <ApiErrorAlert
        message="โหลดรายชื่อหน่วยงานไม่สำเร็จ จึงยังเลือกขอบเขตไม่ได้"
        onRetry={() => orgQueries.forEach((q) => void q.refetch())}
      />
    );
  }
  if (orgQueries.some((q) => q.isLoading)) {
    return (
      <div role="status" className="flex flex-col gap-3 md:flex-row">
        <span className="sr-only">กำลังโหลดรายชื่อหน่วยงาน</span>
        <Skeleton className="h-11 md:w-48" />
        <Skeleton className="h-11 flex-1 md:min-w-[22rem]" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-3 md:flex-row">
        <FormField
          control={control}
          name={levelFieldName}
          render={({ field }) => (
            <FormItem className="md:w-48">
              <FormLabel>ระดับขอบเขต</FormLabel>
              {onlyLevel ? (
                <p className="flex min-h-11 items-center text-sm font-medium text-primary">
                  {SCOPE_LEVEL_LABELS[onlyLevel]}
                </p>
              ) : (
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    resetField(targetFieldName, { defaultValue: '' });
                  }}
                  value={field.value || undefined}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกระดับ" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {levels.map((value) => (
                      <SelectItem key={value} value={value} className="min-h-11">
                        {SCOPE_LEVEL_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={targetFieldName}
          render={({ field }) => (
            <FormItem className="flex-1 md:min-w-[22rem]">
              <FormLabel>หน่วยงาน</FormLabel>
              {onlyTarget ? (
                <p className="flex min-h-11 items-center break-words text-sm font-medium text-primary">
                  {onlyTarget.label}
                </p>
              ) : (
                <FormControl>
                  <Combobox
                    className={TRIGGER_CLASS}
                    options={targetOptions}
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                    disabled={!level}
                    placeholder="เลือกหน่วยงาน"
                    searchPlaceholder="ค้นหาชื่อ รหัส หรือคณะ..."
                    emptyText="ไม่พบหน่วยงานที่ตรงกับคำค้นหา"
                  />
                </FormControl>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      {limitedToOwnScope && onlyTarget && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
          คุณมีสิทธิ์กำหนดขอบเขตได้เฉพาะหน่วยงานนี้ (ตามขอบเขตความรับผิดชอบของคุณ)
        </p>
      )}
    </div>
  );
}
