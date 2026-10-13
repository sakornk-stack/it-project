import { UserDetailPageContent } from '@/components/admin/user-detail-page-content';

export default function UserDetailPage({ params }: { params: { id: string } }) {
  return <UserDetailPageContent userId={params.id} basePath="/admin" />;
}
