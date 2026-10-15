import { RoleLayoutGuard } from '@/components/auth/role-layout-guard';

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayoutGuard role="INSTRUCTOR">{children}</RoleLayoutGuard>;
}
