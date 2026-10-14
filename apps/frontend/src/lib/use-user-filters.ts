'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CLEARED_USER_FILTERS,
  DEFAULT_USER_FILTERS,
  parseRoleParam,
  type UserFilters,
} from '@/lib/user-list-filter';

// The users list's filters live above the table so the stat cards and the filter
// bar drive the same state.
export function useUserFilters() {
  const [filters, setFilters] = useState<UserFilters>(DEFAULT_USER_FILTERS);
  const update = useCallback(
    (patch: Partial<UserFilters>) => setFilters((current) => ({ ...current, ...patch })),
    [],
  );
  // A link such as /superadmin/users?role=ADMIN opens the list already narrowed to that role.
  useEffect(() => {
    const role = parseRoleParam(new URLSearchParams(window.location.search).get('role'));
    if (role) setFilters((current) => ({ ...current, role }));
  }, []);
  const clear = useCallback(() => setFilters(CLEARED_USER_FILTERS), []);
  return { filters, update, clear };
}

export type UserFiltersControl = ReturnType<typeof useUserFilters>;
