'use client';

import { useState } from 'react';
import { ListChecks, Pencil, Plus } from 'lucide-react';
import type { CloPloMappingItem, PloListItem } from '@eduanalyze-ai/shared-types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PloEditSheet, type PloSheetTarget } from './plo-edit-sheet';
import { cloCountOfPlo } from './outcomes-view';

// The PLO list of the curriculum: add, edit, delete (the sheet holds the form).
export function PloTab({
  curriculumId,
  curriculumLabel,
  plos,
  mappings,
  onChanged,
}: Readonly<{
  curriculumId: string;
  curriculumLabel: string;
  plos: PloListItem[];
  mappings: CloPloMappingItem[];
  onChanged: () => void;
}>) {
  const [sheet, setSheet] = useState<PloSheetTarget | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setSheet({ kind: 'create' })}>
          <Plus size={16} aria-hidden="true" className="mr-1.5" />
          เพิ่ม PLO
        </Button>
      </div>
      {plos.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="ยังไม่มี PLO"
          description="เพิ่ม PLO ของหลักสูตรนี้ได้ที่ปุ่มด้านบน"
        />
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-card">
          {plos.map((plo) => (
            <li key={plo.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-semibold">{plo.code}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    มี {cloCountOfPlo(plo.id, mappings)} CLO ที่ตอบ PLO นี้
                  </span>
                </div>
                <p className="break-words text-sm font-medium">{plo.name}</p>
                {plo.description && (
                  <p className="break-words text-sm text-muted-foreground">{plo.description}</p>
                )}
              </div>
              <Button
                variant="outline"
                aria-label={`แก้ไข ${plo.code}`}
                onClick={() => setSheet({ kind: 'edit', plo })}
              >
                <Pencil size={14} aria-hidden="true" className="mr-1.5" />
                แก้ไข
              </Button>
            </li>
          ))}
        </ul>
      )}
      <PloEditSheet
        target={sheet}
        onClose={() => setSheet(null)}
        curriculumId={curriculumId}
        curriculumLabel={curriculumLabel}
        onChanged={onChanged}
      />
    </div>
  );
}
