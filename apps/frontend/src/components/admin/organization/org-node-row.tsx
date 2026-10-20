'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, FolderOpen } from 'lucide-react';
import type { OrgEntityFormValues } from '@/lib/validation/organization.schema';
import type { OrgLevel } from '@/lib/org-tree-view';
import { cn } from '@/lib/utils';
import { HighlightText } from './highlight-text';
import { orgLevelMeta } from './org-level';
import { OrgEntityForm } from './org-entity-form';
import { OrgNodeMenu } from './org-node-menu';
import { describeApiError } from '@/lib/describe-api-error';
import { orgWriteErrors } from '@/lib/api-error-presets';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { DeactivateConfirm } from '@/components/admin/deactivate-confirm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export interface AddChildConfig {
  // e.g. "ภาควิชา" — the row builds "เพิ่มภาควิชา" and the empty-state text from it.
  childLabel: string;
  onCreate: (values: OrgEntityFormValues) => Promise<void>;
}

export function OrgNodeRow({
  item,
  level,
  term = '',
  summary,
  childCount,
  childLabel,
  expanded,
  onToggle,
  onUpdate,
  onDeactivate,
  addChild,
  children,
}: {
  item: { id: string; name: string; code: string };
  level: Exclude<OrgLevel, 'curriculum'>;
  // The search text, to mark where it matches in the name and code.
  term?: string;
  // What sits below, e.g. "8 ภาควิชา · 24 สาขา · 18 หลักสูตร".
  summary: string;
  // Direct children only: decides whether the node can be deactivated.
  childCount: number;
  childLabel: string;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (values: OrgEntityFormValues) => Promise<void>;
  onDeactivate: () => Promise<void>;
  addChild?: AddChildConfig;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { label: levelLabel, icon: Icon, tile } = orgLevelMeta(level);
  // The body mounts when first opened and then animates its height; it stays mounted (hidden)
  // after a close so the collapse can play too.
  const [mounted, setMounted] = useState(expanded);
  const [shown, setShown] = useState(expanded);
  useEffect(() => {
    if (!expanded) {
      setShown(false);
      return;
    }
    setMounted(true);
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setShown(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [expanded]);
  const nodeLabel = `${levelLabel}${item.name}`;

  async function handleDeactivate() {
    setBusy(true);
    setError(null);
    try {
      await onDeactivate();
    } catch (err) {
      setError(
        describeApiError(
          err,
          orgWriteErrors(`ปิดใช้งานไม่ได้ เพราะยังมี${childLabel}ที่ใช้งานอยู่`),
        ),
      );
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  function startAdding() {
    if (!expanded) onToggle();
    setAdding(true);
  }

  return (
    <div id={`org-node-${item.id}`} className="rounded-lg border border-slate-200 bg-background">
      {/* The whole row toggles; the controls inside stop the click so they do not. */}
      <div
        role="presentation"
        onClick={onToggle}
        className="interactive-row flex cursor-pointer flex-wrap items-start justify-between gap-2 rounded-lg px-3 py-2"
      >
        <button
          type="button"
          id={`org-toggle-${item.id}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          aria-expanded={expanded}
          className="flex min-h-11 w-full min-w-0 items-start gap-3 text-left sm:w-auto sm:flex-1"
        >
          <ChevronRight
            size={18}
            aria-hidden="true"
            className={cn(
              'mt-2.5 shrink-0 text-slate-500 transition-transform duration-200 motion-reduce:transition-none',
              expanded && 'rotate-90',
            )}
          />
          <span
            aria-hidden="true"
            className={cn(
              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
              tile,
            )}
          >
            <Icon size={18} />
          </span>
          <span className="min-w-0 space-y-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{levelLabel}</span>
              <span title={item.name} className="break-words text-sm font-semibold text-primary">
                <HighlightText text={item.name} term={term} />
              </span>
              <Badge tone="neutral" className="font-mono">
                <HighlightText text={item.code} term={term} />
              </Badge>
            </span>
            <span className="block text-xs tabular-nums text-muted-foreground">{summary}</span>
          </span>
        </button>
        <div
          role="presentation"
          className="ml-auto shrink-0"
          onClick={(event) => event.stopPropagation()}
        >
          <OrgNodeMenu
            nodeLabel={nodeLabel}
            onEdit={() => setEditing(true)}
            addLabel={addChild ? `เพิ่ม${addChild.childLabel}` : undefined}
            onAdd={addChild ? startAdding : undefined}
            onDeactivate={() => setConfirming(true)}
            deactivateBlockedReason={
              childCount > 0
                ? `ยังมี ${childCount} ${childLabel}ที่ใช้งานอยู่ — ต้องปิดใช้งานรายการด้านล่างให้หมดก่อน`
                : undefined
            }
          />
        </div>
      </div>

      {error && (
        <div className="px-3 pb-3">
          <ApiErrorAlert message={error} />
        </div>
      )}

      {editing && (
        <div className="px-3 pb-3">
          <OrgEntityForm
            defaultValues={{ name: item.name, code: item.code }}
            submitLabel="บันทึก"
            onSubmit={async (values) => {
              await onUpdate(values);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}

      {mounted && (
        <div
          className={cn(
            'grid border-t border-slate-100 transition-[grid-template-rows,visibility] duration-200 ease-out motion-reduce:transition-none',
            shown ? 'grid-rows-[1fr]' : 'invisible grid-rows-[0fr]',
          )}
        >
          <div className="-m-1 overflow-hidden p-1">
            {/* The thin guide line under the chevron ties the children to this row. */}
            <div className="space-y-2 py-3 pl-[21px] pr-3">
              <div className="space-y-2 border-l border-slate-200 pl-3 sm:pl-4">
                {adding && addChild && (
                  <OrgEntityForm
                    submitLabel={`เพิ่ม${addChild.childLabel}`}
                    onSubmit={async (values) => {
                      await addChild.onCreate(values);
                      setAdding(false);
                    }}
                    onCancel={() => setAdding(false)}
                  />
                )}
                {childCount === 0 && addChild && !adding ? (
                  <EmptyState
                    icon={FolderOpen}
                    description={`ยังไม่มี${addChild.childLabel}ใน${levelLabel}นี้`}
                    action={
                      <Button type="button" onClick={() => setAdding(true)}>
                        เพิ่ม{addChild.childLabel}แรก
                      </Button>
                    }
                  />
                ) : (
                  children
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <DeactivateConfirm
        open={confirming}
        onOpenChange={setConfirming}
        itemLabel={nodeLabel}
        busy={busy}
        onConfirm={handleDeactivate}
      />
    </div>
  );
}
