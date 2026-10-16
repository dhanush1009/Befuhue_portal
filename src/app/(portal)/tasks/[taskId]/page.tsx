import { PageHeader } from '@/components/layout/PageHeader';

export default function TaskDetailPage({ params }: { params: { taskId: string } }) {
  return (
    <div className="max-w-4xl mx-auto pb-10">
      <PageHeader title="Task Detail" />
    </div>
  );
}
