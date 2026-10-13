import { RoleLayoutGuard } from '@/components/auth/role-layout-guard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayoutGuard role="ADMIN">{children}</RoleLayoutGuard>;
}
