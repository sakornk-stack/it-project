import { useQuery } from '@tanstack/react-query';
import { fetchAdminScopeOverview } from '@/lib/api/admin';
import { directoryFromScopeOverview } from '@/lib/admin-curricula';

// The curricula inside the requesting ADMIN's own scope.
export function useCurriculumDirectory() {
  return useQuery({
    queryKey: ['admin-scope-overview'],
    queryFn: fetchAdminScopeOverview,
    select: directoryFromScopeOverview,
  });
}
