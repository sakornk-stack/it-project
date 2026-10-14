'use client';

import { ChevronsDownUp, ChevronsUpDown, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const SEGMENT =
  'inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground sm:min-h-9 sm:flex-none motion-reduce:transition-none';

// Search, expand/collapse and the inactive switch. Stacks on a phone; every control is 44px
// tall there. The result count is announced politely as the search text changes.
export function OrgToolbar({
  search,
  onSearchChange,
  resultCount,
  onExpandAll,
  onCollapseAll,
  showInactive,
  onShowInactiveChange,
  inactiveCount,
}: Readonly<{
  search: string;
  onSearchChange: (value: string) => void;
  // null when not searching.
  resultCount: number | null;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  showInactive: boolean;
  onShowInactiveChange: (value: boolean) => void;
  // Known only once the inactive list has been loaded.
  inactiveCount: number | null;
}>) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-md lg:flex-1">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="ค้นหาชื่อหรือรหัส คณะ ภาควิชา สาขา หรือฉบับหลักสูตร"
            placeholder="ค้นหาชื่อ/รหัส คณะ ภาควิชา สาขา หรือฉบับหลักสูตร..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-9 pr-11 [&::-webkit-search-cancel-button]:hidden"
          />
          {search !== '' && (
            <button
              type="button"
              aria-label="ล้างข้อความค้นหา"
              onClick={() => onSearchChange('')}
              className="absolute right-0.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        <div
          role="group"
          aria-label="การขยายต้นไม้"
          className="flex rounded-md border bg-card p-0.5 lg:inline-flex"
        >
          <button
            type="button"
            className={SEGMENT}
            title="ขยายทุกคณะ ภาควิชา และสาขา"
            onClick={onExpandAll}
          >
            <ChevronsUpDown size={16} aria-hidden="true" />
            ขยายทั้งหมด
          </button>
          <button type="button" className={SEGMENT} title="ยุบทุกระดับ" onClick={onCollapseAll}>
            <ChevronsDownUp size={16} aria-hidden="true" />
            ยุบทั้งหมด
          </button>
        </div>

        <Switch
          checked={showInactive}
          onCheckedChange={onShowInactiveChange}
          className="lg:ml-auto"
        >
          แสดงที่ปิดใช้งาน
          {showInactive && inactiveCount !== null && (
            <Badge tone="neutral" className={cn('tabular-nums')}>
              {inactiveCount.toLocaleString('th-TH')}
            </Badge>
          )}
        </Switch>
      </div>

      <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
        {resultCount === null
          ? ''
          : resultCount === 0
            ? 'ไม่พบรายการที่ตรงกับคำค้นหา'
            : `พบ ${resultCount.toLocaleString('th-TH')} รายการ`}
      </p>
    </div>
  );
}
