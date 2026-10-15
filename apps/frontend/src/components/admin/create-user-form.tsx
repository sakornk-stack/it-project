'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateUserRequest, CreateUserResponse, Role } from '@eduanalyze-ai/shared-types';
import { allowedLevels, allowedScopeTargets } from '@/lib/admin-scope-options';
import { fetchDepartments, fetchFaculties, fetchPrograms } from '@/lib/api/organization';
import { createUser, fetchUser } from '@/lib/api/user-management';
import { useAuth } from '@/lib/auth-context';
import { createUserSchema, type CreateUserFormValues } from '@/lib/validation/create-user.schema';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { describeApiError } from '@/lib/describe-api-error';
import { ApiErrorAlert, WARNING_ALERT_CLASS } from '@/components/ui/api-error-alert';
import { ROLE_LABEL_TH } from '@/components/auth/require-role';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScopeSelector } from './scope-selector';

// SUPER_ADMIN deliberately excluded — never creatable via API, even by an
// existing SUPER_ADMIN (advisor feedback, see plan file "เรื่องที่ 2").
// Provisioning a new one is an out-of-band database action; the backend
// rejects role:SUPER_ADMIN with 403 unconditionally, so it's never
// offered here either.
const CREATABLE_ROLES: { value: Role; label: string }[] = [
  { value: 'INSTRUCTOR', label: ROLE_LABEL_TH.INSTRUCTOR },
  { value: 'STAFF', label: ROLE_LABEL_TH.STAFF },
  { value: 'ADMIN', label: ROLE_LABEL_TH.ADMIN },
];

// ADMIN can only ever create STAFF (backend-enforced) — the role field
// still exists in form state for zod to validate, it's just never shown
// as a choice, so an ADMIN can never even attempt (and get 403'd by) a
// different role.
export function CreateUserForm({
  requesterIsSuperAdmin,
  onCreated,
  onCancel,
}: {
  requesterIsSuperAdmin: boolean;
  onCreated: (result: CreateUserResponse) => void;
  onCancel: () => void;
}) {
  const { user: requester } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  // An Admin may only name units inside their own scope. Same query keys as the
  // user detail page and ScopeSelector, so all of it comes from the shared cache.
  const needsScopeFilter = !requesterIsSuperAdmin;
  const ownUserQuery = useQuery({
    queryKey: ['admin-users', requester?.userId],
    queryFn: () => fetchUser(requester!.userId),
    enabled: needsScopeFilter && !!requester,
  });
  const facultiesQuery = useQuery({ queryKey: ['faculties'], queryFn: fetchFaculties });
  const departmentsQuery = useQuery({ queryKey: ['departments'], queryFn: fetchDepartments });
  const programsQuery = useQuery({ queryKey: ['programs'], queryFn: fetchPrograms });
  const allowed = useMemo(() => {
    if (!needsScopeFilter) return undefined;
    if (
      !ownUserQuery.data ||
      !facultiesQuery.data ||
      !departmentsQuery.data ||
      !programsQuery.data
    ) {
      return null;
    }
    return allowedScopeTargets(ownUserQuery.data.scopes, {
      faculties: facultiesQuery.data,
      departments: departmentsQuery.data,
      programs: programsQuery.data,
    });
  }, [
    needsScopeFilter,
    ownUserQuery.data,
    facultiesQuery.data,
    departmentsQuery.data,
    programsQuery.data,
  ]);
  const scopeLoadFailed =
    needsScopeFilter &&
    (ownUserQuery.isError ||
      facultiesQuery.isError ||
      departmentsQuery.isError ||
      programsQuery.isError);
  const noScopeToGrant = allowed ? allowedLevels(allowed).length === 0 : false;
  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      fullName: '',
      role: requesterIsSuperAdmin ? undefined : 'STAFF',
      scopeLevel: undefined,
      scopeTargetId: '',
    },
  });

  const role = form.watch('role');
  const scopeVisible = role === 'STAFF' || role === 'ADMIN';

  // Scope fields become stale/irrelevant the moment role changes away
  // from STAFF/ADMIN — clear them so a previously-picked scope can't be
  // silently submitted under a role it no longer applies to.
  useEffect(() => {
    if (!scopeVisible) {
      form.resetField('scopeLevel', { defaultValue: undefined });
      form.resetField('scopeTargetId', { defaultValue: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeVisible]);

  async function onSubmit(values: CreateUserFormValues) {
    setServerError(null);
    const payload: CreateUserRequest = {
      email: values.email,
      fullName: values.fullName,
      role: values.role,
      scope:
        values.scopeLevel && values.scopeTargetId
          ? { level: values.scopeLevel, targetId: values.scopeTargetId }
          : undefined,
    };
    try {
      const result = await createUser(payload);
      onCreated(result);
    } catch (error) {
      setServerError(describeApiError(error, { 409: 'อีเมลนี้ถูกใช้งานแล้ว' }));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>เพิ่มผู้ใช้งาน</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {serverError && <ApiErrorAlert message={serverError} />}

            {scopeLoadFailed ? (
              <Alert role="alert" className={WARNING_ALERT_CLASS}>
                <AlertDescription>
                  โหลดขอบเขตของคุณไม่สำเร็จ จึงยังเพิ่มผู้ใช้งานไม่ได้ กรุณาลองใหม่อีกครั้ง
                </AlertDescription>
              </Alert>
            ) : noScopeToGrant ? (
              <Alert role="alert" className={WARNING_ALERT_CLASS}>
                <AlertDescription>
                  บัญชีของคุณยังไม่มีหน่วยงานที่มอบขอบเขตให้ผู้อื่นได้ จึงเพิ่มผู้ใช้งานไม่ได้ —
                  ติดต่อผู้ดูแลระบบสูงสุดเพื่อกำหนดขอบเขตให้คุณก่อน
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ชื่อ-นามสกุล</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>อีเมล</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {requesterIsSuperAdmin ? (
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem className="md:w-64">
                        <FormLabel>บทบาท</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="เลือกบทบาท" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CREATABLE_ROLES.map((r) => (
                              <SelectItem key={r.value} value={r.value} className="min-h-11">
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    เพิ่มผู้ใช้งานบทบาท:{' '}
                    <span className="font-medium text-primary">{ROLE_LABEL_TH.STAFF}</span>
                  </p>
                )}

                {scopeVisible &&
                  (allowed === null ? (
                    <div role="status">
                      <span className="sr-only">กำลังโหลดขอบเขตของคุณ</span>
                      <Skeleton className="h-11 w-full" />
                    </div>
                  ) : (
                    <ScopeSelector
                      levelFieldName="scopeLevel"
                      targetFieldName="scopeTargetId"
                      allowed={allowed}
                      limitedToOwnScope={needsScopeFilter}
                    />
                  ))}
              </>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                disabled={
                  form.formState.isSubmitting ||
                  scopeLoadFailed ||
                  noScopeToGrant ||
                  allowed === null
                }
              >
                {form.formState.isSubmitting ? 'กำลังเพิ่ม...' : 'เพิ่มผู้ใช้งาน'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={form.formState.isSubmitting}
                onClick={onCancel}
              >
                ยกเลิก
              </Button>
            </div>
          </CardContent>
        </form>
      </Form>
    </Card>
  );
}
