'use client';

import { lockHint } from '@/lib/admin-user-guard';
import { useId, useMemo, useState } from 'react';
import {
  Building2,
  GraduationCap,
  Landmark,
  Plus,
  Waypoints,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Role, ScopeLevel, UserScope } from '@eduanalyze-ai/shared-types';
import {
  allActiveScopeTargets,
  allowedLevels,
  allowedScopeTargets,
  excludeHeldScopes,
} from '@/lib/admin-scope-options';
import { formatThaiDate } from '@/lib/admin-users';
import { fetchDepartments, fetchFaculties, fetchPrograms } from '@/lib/api/organization';
import { createUserScope, deleteUserScope } from '@/lib/api/user-management';
import { SCOPE_LEVEL_LABELS } from '@/lib/scope-labels';
import { scopeAncestorNames } from '@/lib/scope-hierarchy';
import { useScopeTargetName } from '@/lib/use-scope-target-name';
import { scopeSchema, type ScopeFormValues } from '@/lib/validation/scope.schema';
import { AddButton } from '@/components/admin/add-button';
import { WARNING_ALERT_CLASS } from '@/components/ui/api-error-alert';
import { DetailSectionHeader } from '@/components/ui/detail-section-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { roleNeedsScope } from '@/lib/user-scope-requirement';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { RevokeButton, RevokeIconButton } from './revoke-button';
import { describeApiError } from '@/lib/describe-api-error';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/lib/toast-context';
import { Form } from '@/components/ui/form';
import { ScopeSelector } from './scope-selector';

const SCOPE_LEVEL_ICONS: Record<ScopeLevel, LucideIcon> = {
  FACULTY: Landmark,
  DEPARTMENT: Building2,
  PROGRAM: GraduationCap,
};

export function UserScopesSection({
  userId,
  roles,
  scopes,
  lockedReason,
  requesterIsSuperAdmin,
  requesterScopes,
  onChanged,
}: {
  userId: string;
  roles: Role[];
  scopes: UserScope[];
  lockedReason: string | null;
  requesterIsSuperAdmin: boolean;
  // The requester's own scopes; null until loaded (not needed for a SUPER_ADMIN).
  requesterScopes: UserScope[] | null;
  onChanged: () => void;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  // The add form opens from the header button instead of sitting open under the list.
  const [adding, setAdding] = useState(false);
  const addPanelId = useId();
  const toast = useToast();

  const resolveTargetName = useScopeTargetName();
  const facultiesQuery = useQuery({ queryKey: ['faculties'], queryFn: fetchFaculties });
  const departmentsQuery = useQuery({ queryKey: ['departments'], queryFn: fetchDepartments });
  const programsQuery = useQuery({ queryKey: ['programs'], queryFn: fetchPrograms });
  const orgQueries = [facultiesQuery, departmentsQuery, programsQuery];
  // What may be added: units inside the requester's own scope (any, for a
  // SUPER_ADMIN), minus those this user already holds. null while loading.
  const allowed = useMemo(() => {
    if (!facultiesQuery.data || !departmentsQuery.data || !programsQuery.data) return null;
    const org = {
      faculties: facultiesQuery.data,
      departments: departmentsQuery.data,
      programs: programsQuery.data,
    };
    if (!requesterIsSuperAdmin && !requesterScopes) return null;
    const base = requesterIsSuperAdmin
      ? allActiveScopeTargets(org)
      : allowedScopeTargets(requesterScopes ?? [], org);
    return excludeHeldScopes(base, scopes);
  }, [
    facultiesQuery.data,
    departmentsQuery.data,
    programsQuery.data,
    requesterIsSuperAdmin,
    requesterScopes,
    scopes,
  ]);
  // The Admin's own scope itself reaches a single unit, so the lack of a choice is
  // about their rights and not just about what this user already holds.
  const limitedToOneUnit = useMemo(() => {
    if (requesterIsSuperAdmin || !requesterScopes) return false;
    if (!facultiesQuery.data || !departmentsQuery.data || !programsQuery.data) return false;
    const own = allowedScopeTargets(requesterScopes, {
      faculties: facultiesQuery.data,
      departments: departmentsQuery.data,
      programs: programsQuery.data,
    });
    return own.FACULTY.size + own.DEPARTMENT.size + own.PROGRAM.size === 1;
  }, [
    requesterIsSuperAdmin,
    requesterScopes,
    facultiesQuery.data,
    departmentsQuery.data,
    programsQuery.data,
  ]);
  const nothingToAdd = allowed !== null && allowedLevels(allowed).length === 0;
  const canOpenAddPanel = !lockedReason && allowed !== null && !nothingToAdd;

  const orgNames =
    facultiesQuery.data && departmentsQuery.data && programsQuery.data
      ? {
          faculties: facultiesQuery.data,
          departments: departmentsQuery.data,
          programs: programsQuery.data,
        }
      : null;

  const confirmingScope = scopes.find((scope) => scope.id === confirmingId) ?? null;

  const form = useForm<ScopeFormValues>({
    resolver: zodResolver(scopeSchema),
    defaultValues: { level: undefined, targetId: '' },
  });

  const pickedLevel = form.watch('level');
  const pickedTarget = form.watch('targetId');

  async function onSubmit(values: ScopeFormValues) {
    setServerError(null);
    try {
      await createUserScope(userId, values);
      toast.success('เพิ่มขอบเขตความรับผิดชอบแล้ว');
      form.reset({ level: undefined, targetId: '' });
      setAdding(false);
      onChanged();
    } catch (error) {
      setServerError(describeApiError(error));
    }
  }

  async function handleRevoke(scopeId: string) {
    setBusyId(scopeId);
    setServerError(null);
    try {
      await deleteUserScope(userId, scopeId);
      toast.success('ถอนขอบเขตความรับผิดชอบแล้ว');
      setConfirmingId(null);
      onChanged();
    } catch (error) {
      setServerError(describeApiError(error));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <DetailSectionHeader
        icon={Waypoints}
        title="ขอบเขตการกำกับดูแลและสิทธิ์วิชาการ"
        description={
          lockedReason ? `แก้ไขขอบเขตไม่ได้ — ${lockHint(lockedReason, roles)}` : undefined
        }
        action={
          canOpenAddPanel && (
            <Button
              type="button"
              variant="outline"
              className="w-full gap-1.5 sm:w-auto"
              aria-expanded={adding}
              aria-controls={addPanelId}
              onClick={() => setAdding((open) => !open)}
            >
              {adding ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
              {adding ? 'ยกเลิก' : 'เพิ่มขอบเขต'}
            </Button>
          )
        }
      />
      <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
        {serverError && <ApiErrorAlert message={serverError} />}

        {scopes.length === 0 ? (
          roleNeedsScope(roles) ? (
            <Alert className={WARNING_ALERT_CLASS}>
              <AlertDescription>
                ยังไม่มีขอบเขตความรับผิดชอบ —
                เจ้าหน้าที่และผู้ดูแลระบบจะเข้าถึงข้อมูลของหน่วยงานใดไม่ได้ จนกว่าจะเพิ่มขอบเขต
              </AlertDescription>
            </Alert>
          ) : (
            <EmptyState
              icon={Waypoints}
              description="ยังไม่มีขอบเขตความรับผิดชอบ"
              className="rounded-lg border border-dashed"
            />
          )
        ) : (
          <ul className="space-y-3">
            {scopes.map((scope) => {
              const LevelIcon = SCOPE_LEVEL_ICONS[scope.level];
              const name = resolveTargetName(scope);
              const ancestors = orgNames ? scopeAncestorNames(scope, orgNames) : [];
              return (
                <li
                  key={scope.id}
                  className="interactive-row flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 sm:flex-nowrap sm:p-4"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand sm:h-10 sm:w-10"
                  >
                    <LevelIcon size={20} />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="course-name-break font-medium">{name}</span>
                      <Badge tone="neutral">{SCOPE_LEVEL_LABELS[scope.level]}</Badge>
                    </div>
                    {ancestors.length > 0 && (
                      <p className="course-name-break text-sm text-muted-foreground">
                        {ancestors.join(' · ')}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      มอบสิทธิ์เมื่อ {formatThaiDate(scope.createdAt)}
                    </p>
                  </div>
                  {/* On a phone the action is a written, full-width button (no hover-only
                      tooltip to read); from sm up it is the quiet trash icon. */}
                  {!lockedReason && (
                    <>
                      <RevokeButton
                        label="ถอดขอบเขต"
                        className="w-full sm:hidden"
                        onClick={() => setConfirmingId(scope.id)}
                      />
                      <span className="hidden sm:block">
                        <RevokeIconButton
                          label="ถอดขอบเขต"
                          onClick={() => setConfirmingId(scope.id)}
                        />
                      </span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {!lockedReason &&
          (allowed === null ? (
            orgQueries.some((q) => q.isError) ? (
              <div className="border-t border-border pt-3">
                <ApiErrorAlert
                  message="โหลดรายชื่อหน่วยงานไม่สำเร็จ จึงยังเพิ่มขอบเขตไม่ได้"
                  onRetry={() => orgQueries.forEach((q) => void q.refetch())}
                />
              </div>
            ) : (
              <div role="status" className="border-t border-border pt-3">
                <span className="sr-only">กำลังโหลดหน่วยงานที่เพิ่มได้</span>
                <Skeleton className="h-11 w-full" />
              </div>
            )
          ) : nothingToAdd ? (
            <p className="border-t border-border pt-3 text-sm text-muted-foreground">
              ไม่มีหน่วยงานที่เพิ่มเป็นขอบเขตให้ผู้ใช้นี้ได้แล้ว —
              ผู้ใช้ถืออยู่ครบทุกหน่วยในขอบเขตของคุณ หรือคุณไม่มีสิทธิ์มอบขอบเขตเพิ่ม
            </p>
          ) : (
            adding && (
              <Form {...form}>
                <form
                  id={addPanelId}
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 duration-200 animate-in fade-in-0 slide-in-from-top-1 motion-reduce:animate-none md:flex-row md:flex-wrap md:items-end"
                >
                  <div className="min-w-0 flex-1">
                    <ScopeSelector allowed={allowed} limitedToOwnScope={limitedToOneUnit} />
                  </div>
                  <AddButton
                    type="submit"
                    disabled={form.formState.isSubmitting || !pickedLevel || !pickedTarget}
                    className="w-full md:w-auto"
                    aria-describedby={pickedLevel && pickedTarget ? undefined : 'scope-add-hint'}
                  >
                    เพิ่มขอบเขต
                  </AddButton>
                  {!(pickedLevel && pickedTarget) && (
                    <p id="scope-add-hint" className="text-xs text-muted-foreground md:basis-full">
                      เลือกระดับและหน่วยงานก่อน จึงจะเพิ่มขอบเขตได้
                    </p>
                  )}
                </form>
              </Form>
            )
          ))}
      </CardContent>
      <ConfirmDialog
        open={confirmingScope !== null}
        onOpenChange={(open) => !open && setConfirmingId(null)}
        title="ถอดขอบเขตความรับผิดชอบ?"
        description={
          confirmingScope
            ? `ผู้ใช้นี้จะไม่เข้าถึงข้อมูลของ${SCOPE_LEVEL_LABELS[confirmingScope.level]}${resolveTargetName(confirmingScope)} ได้อีก`
            : ''
        }
        confirmLabel="ถอดขอบเขต"
        busy={busyId !== null}
        onConfirm={() => confirmingScope && handleRevoke(confirmingScope.id)}
      />
    </Card>
  );
}
