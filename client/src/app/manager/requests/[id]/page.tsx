import { redirect } from 'next/navigation';

interface PageParams {
  id: string;
}

export default async function Page({ 
  params,
  searchParams 
}: { 
  params: Promise<PageParams>;
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const { id } = await params;
  return redirect(`/manager?requestId=${id}`);
}