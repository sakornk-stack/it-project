'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { pageWindow } from '@/lib/page-window';
import { paginationSummary, type PaginationUnit } from '@/lib/pagination-summary';
import { cn } from '@/lib/utils';

export const PAGE_SIZES = [10, 25, 50] as const;

// The one pager for every role. The sentence says what the total counts (`unit`),
// the page numbers appear only when there is more than one page, and the
// rows-per-page choice appears only when the caller lets the reader change it.
export function Pagination({
  page,
  pageCount,
  total,
  rangeStart,
  rangeEnd,
  unit = 'รายการ',
  pageSize,
  onPageChange,
  onPageSizeChange,
}: Readonly<{
  page: number;
  pageCount: number;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  unit?: PaginationUnit;
  pageSize?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}>) {
  if (total === 0) {
    return <p className="pt-3 text-sm text-muted-foreground">{paginationSummary(0, 0, 0)}</p>;
  }

  return (
    <div className="flex flex-col gap-3 pt-3 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <p>{paginationSummary(rangeStart, rangeEnd, total, unit)}</p>
        {pageSize !== undefined && onPageSizeChange && (
          <label className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            แสดงแถว
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger className="w-28" aria-label="จำนวนแถวต่อหน้า">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        )}
      </div>
      {pageCount > 1 && (
        <nav aria-label="เลือกหน้า" className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-1 px-3"
            aria-label="หน้าก่อนหน้า"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            <span className="hidden sm:inline">ก่อนหน้า</span>
          </Button>
          {pageWindow(page, pageCount).map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} aria-hidden="true" className="px-1">
                …
              </span>
            ) : (
              <Button
                key={p}
                type="button"
                variant={p === page ? 'default' : 'outline'}
                className={cn('min-w-11 px-3 tabular-nums')}
                aria-label={`หน้า ${p}`}
                aria-current={p === page ? 'page' : undefined}
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            ),
          )}
          <Button
            type="button"
            variant="outline"
            className="gap-1 px-3"
            aria-label="หน้าถัดไป"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            <span className="hidden sm:inline">ถัดไป</span>
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Button>
        </nav>
      )}
    </div>
  );
}
