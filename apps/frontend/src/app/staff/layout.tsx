import { RoleLayoutGuard } from '@/components/auth/role-layout-guard';

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayoutGuard role="STAFF">{children}</RoleLayoutGuard>;
}
