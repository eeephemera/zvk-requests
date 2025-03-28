import { redirect } from 'next/navigation';

// Используем правильную типизацию для Next.js 15
type Props = {
  params: {
    id: string;
  }
}

// Экспортируем обычную функцию без async
export default function Page(props: Props) {
  const id = props.params.id;
  // Используем redirect для серверного редиректа
  redirect(`/manager?requestId=${id}`);
}