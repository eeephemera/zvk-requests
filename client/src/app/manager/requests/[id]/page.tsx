import { redirect } from 'next/navigation';

interface PageParams {
  id: string;
}

export default async function Page({ 
  params,
}: { 
  params: Promise<PageParams>;
}) {
  const { id } = await params;
  return redirect(`/manager?requestId=${id}`);
}