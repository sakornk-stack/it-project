import { UserDetailPageContent } from '@/components/admin/user-detail-page-content';

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserDetailPageContent userId={id} basePath="/superadmin" />;
}
