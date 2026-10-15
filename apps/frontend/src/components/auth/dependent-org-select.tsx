'use client';

import { useQuery } from '@tanstack/react-query';
import { useFormContext } from 'react-hook-form';
import {
  fetchCurricula,
  fetchDepartments,
  fetchFaculties,
  fetchPrograms,
} from '@/lib/api/organization';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { Skeleton } from '@/components/ui/skeleton';

// Expects to be rendered inside a <Form> whose schema has facultyId/
// departmentId/programId/curriculumId fields (register.schema.ts and
// complete-google-registration.schema.ts both use this exact shape) — a
// self-contained field group, not parameterized by field name, since
// there's only ever one of these per form.
export function DependentOrgSelect() {
  const { control, watch, resetField } = useFormContext();

  const facultyId = watch('facultyId');
  const departmentId = watch('departmentId');
  const programId = watch('programId');

  const facultiesQuery = useQuery({ queryKey: ['faculties'], queryFn: fetchFaculties });
  const departmentsQuery = useQuery({ queryKey: ['departments'], queryFn: fetchDepartments });
  const programsQuery = useQuery({ queryKey: ['programs'], queryFn: fetchPrograms });
  const curriculaQuery = useQuery({ queryKey: ['curricula'], queryFn: fetchCurricula });

  const departments = (departmentsQuery.data ?? []).filter(
    (d) => d.facultyId === facultyId,
  );
  const programs = (programsQuery.data ?? []).filter(
    (p) => p.departmentId === departmentId,
  );
  // Not filtered by isOpenForRegistration — the backend's own register
  // flow never checks that flag either, and gating on it here would be a
  // stricter, invented rule the API doesn't actually enforce (confirmed
  // by reading AuthService/StudentProfileService — nothing there reads
  // this field at all).
  const curricula = (curriculaQuery.data ?? []).filter(
    (c) => c.programId === programId,
  );

  const orgQueries = [facultiesQuery, departmentsQuery, programsQuery, curriculaQuery];
  if (orgQueries.some((q) => q.isError)) {
    return (
      <ApiErrorAlert
        message="โหลดรายชื่อคณะ ภาควิชา สาขา และหลักสูตรไม่สำเร็จ จึงยังเลือกหลักสูตรไม่ได้"
        onRetry={() => orgQueries.forEach((q) => void q.refetch())}
      />
    );
  }
  if (orgQueries.some((q) => q.isLoading)) {
    return (
      <div role="status" className="space-y-4">
        <span className="sr-only">กำลังโหลดรายชื่อคณะ ภาควิชา สาขา และหลักสูตร</span>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FormField
        control={control}
        name="facultyId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>คณะ</FormLabel>
            <Select
              onValueChange={(value) => {
                field.onChange(value);
                resetField('departmentId', { defaultValue: '' });
                resetField('programId', { defaultValue: '' });
                resetField('curriculumId', { defaultValue: '' });
              }}
              value={field.value || undefined}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกคณะ" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {(facultiesQuery.data ?? []).map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="departmentId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>ภาควิชา</FormLabel>
            <Select
              onValueChange={(value) => {
                field.onChange(value);
                resetField('programId', { defaultValue: '' });
                resetField('curriculumId', { defaultValue: '' });
              }}
              value={field.value || undefined}
              disabled={!facultyId}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกภาควิชา" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="programId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>หลักสูตร</FormLabel>
            <Select
              onValueChange={(value) => {
                field.onChange(value);
                resetField('curriculumId', { defaultValue: '' });
              }}
              value={field.value || undefined}
              disabled={!departmentId}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกหลักสูตร" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="curriculumId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>ฉบับหลักสูตร</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || undefined} disabled={!programId}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกฉบับหลักสูตร" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {curricula.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {`${c.version} (พ.ศ. ${c.effectiveYear})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
