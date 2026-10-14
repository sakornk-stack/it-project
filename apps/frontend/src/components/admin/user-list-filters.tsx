'use client';

import { useRef } from 'react';
import { Search, X } from 'lucide-react';
import type { Role } from '@eduanalyze-ai/shared-types';
import { ROLE_LABEL_TH } from '@/components/auth/require-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ALL, isScopeFilter, isStatusFilter, type UserFilters } from '@/lib/user-list-filter';

// STUDENT never appears here (the list endpoint excludes them).
const FILTERABLE_ROLES = (Object.keys(ROLE_LABEL_TH) as Role[]).filter(
  (role) => role !== 'STUDENT',
);

const ITEM = 'min-h-11';
const TRIGGER = 'h-11 w-full';

export function UserListFilters({
  filters,
  onChange,
  onClear,
  isFiltered,
  shown,
  total,
}: Readonly<{
  filters: UserFilters;
  onChange: (patch: Partial<UserFilters>) => void;
  onClear: () => void;
  isFiltered: boolean;
  shown: number;
  total: number;
}>) {
  const searchRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:max-w-xs sm:flex-1">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={searchRef}
            placeholder="ค้นหาชื่อหรืออีเมล..."
            aria-label="ค้นหาชื่อหรืออีเมล"
            autoComplete="off"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            className="pl-9 pr-11"
          />
          {filters.search !== '' && (
            <button
              type="button"
              aria-label="ล้างคำค้นหา"
              title="ล้างคำค้นหา"
              onClick={() => {
                onChange({ search: '' });
                searchRef.current?.focus();
              }}
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-primary"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="w-full sm:w-44">
          <Select
            value={filters.role}
            onValueChange={(value) => onChange({ role: value as Role | typeof ALL })}
          >
            <SelectTrigger className={TRIGGER} aria-label="กรองตามบทบาท">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem className={ITEM} value={ALL}>
                ทุกบทบาท
              </SelectItem>
              {FILTERABLE_ROLES.map((role) => (
                <SelectItem key={role} value={role} className={ITEM}>
                  {ROLE_LABEL_TH[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-44">
          <Select
            value={filters.status}
            onValueChange={(value) => isStatusFilter(value) && onChange({ status: value })}
          >
            <SelectTrigger className={TRIGGER} aria-label="กรองตามสถานะ">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem className={ITEM} value={ALL}>
                ทุกสถานะ
              </SelectItem>
              <SelectItem className={ITEM} value="ACTIVE">
                ใช้งานอยู่
              </SelectItem>
              <SelectItem className={ITEM} value="PENDING">
                รอตั้งรหัสผ่าน
              </SelectItem>
              <SelectItem className={ITEM} value="SUSPENDED">
                ระงับการใช้งาน
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-52">
          <Select
            value={filters.scope}
            onValueChange={(value) => isScopeFilter(value) && onChange({ scope: value })}
          >
            <SelectTrigger className={TRIGGER} aria-label="กรองตามขอบเขต">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem className={ITEM} value={ALL}>
                ขอบเขตทั้งหมด
              </SelectItem>
              <SelectItem className={ITEM} value="NO_SCOPE">
                ยังไม่กำหนดขอบเขต
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isFiltered && (
          <Button type="button" variant="ghost" className="gap-1.5" onClick={onClear}>
            <X size={16} aria-hidden="true" />
            ล้างตัวกรอง
          </Button>
        )}
      </div>
      {/* Always mounted so a screen reader announces each change of the count. */}
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        แสดง {shown.toLocaleString('th-TH')} จาก {total.toLocaleString('th-TH')} บัญชี
      </p>
    </div>
  );
}
