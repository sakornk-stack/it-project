import { RoleLayoutGuard } from '@/components/auth/role-layout-guard';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayoutGuard role="SUPER_ADMIN">{children}</RoleLayoutGuard>;
}
