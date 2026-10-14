'use client';

import { useState } from 'react';
import { Archive } from 'lucide-react';
import type { InactiveRow } from '@/lib/inactive-items';
import { useToast } from '@/lib/toast-context';
import { ApiErrorAlert } from '@/components/admin/api-error-alert';
import { PermanentDeleteButton } from '@/components/admin/permanent-delete-button';
import { ReactivateButton } from '@/components/admin/reactivate-button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

// Deactivated records, one card per record: what it is, where it sat, and the way
// back. A record whose parent is still closed says what to open first instead.
export function InactiveRecordList({
  rows,
  reactivate,
  permanentDelete,
}: Readonly<{
  rows: InactiveRow[];
  reactivate: (row: InactiveRow) => Promise<void>;
  // Only rows that carry `permanentDelete` get the button, and only when this is passed.
  permanentDelete?: (row: InactiveRow) => Promise<void>;
}>) {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  if (rows.length === 0) {
    return <EmptyState icon={Archive} description="ไม่มีรายการที่ปิดใช้งาน" />;
  }

  return (
    <div className="space-y-3">
      {error && <ApiErrorAlert message={error} onDismiss={() => setError(null)} />}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex flex-col gap-3 rounded-lg border border-dashed bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{row.level}</Badge>
                <Badge tone="danger">ปิดใช้งาน</Badge>
                {row.code && (
                  <Badge tone="neutral" className="font-mono">
                    {row.code}
                  </Badge>
                )}
                <span className="break-words text-sm font-semibold text-primary">{row.title}</span>
              </div>
              {row.path && (
                <p className="break-words text-xs text-muted-foreground">อยู่ใน: {row.path}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {row.blockedBy ? (
                  <p className="text-xs text-muted-foreground sm:max-w-56 sm:text-right">
                    ต้องเปิดใช้งาน{row.blockedBy}ก่อน
                  </p>
                ) : (
                  <ReactivateButton
                    itemLabel={`${row.level} ${row.title}`}
                    onError={setError}
                    onConfirm={async () => {
                      setError(null);
                      await reactivate(row);
                      toast.success(`เปิดใช้งาน${row.level}แล้ว`);
                    }}
                  />
                )}
                {permanentDelete && row.permanentDelete && (
                  <PermanentDeleteButton
                    itemLabel={row.path ? `${row.title} ${row.path}` : row.title}
                    blockedReason={row.permanentDelete.blockedReason}
                    onError={setError}
                    onConfirm={async () => {
                      setError(null);
                      await permanentDelete(row);
                      toast.success(`ลบถาวร${row.level}แล้ว`);
                    }}
                  />
                )}
              </div>
              {permanentDelete && row.permanentDelete?.blockedReason && (
                <p className="text-xs text-muted-foreground sm:max-w-72 sm:text-right">
                  {row.permanentDelete.blockedReason}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
