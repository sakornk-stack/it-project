import { StudentLayoutGuard } from '@/components/auth/role-layout-guard';

// Route group: adds the student gate to the student pages without changing their URLs.
// /profile stays outside it because every role uses that page.
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentLayoutGuard>{children}</StudentLayoutGuard>;
}
